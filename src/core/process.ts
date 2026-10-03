/**
 * Handles one form response: validate everything, create the PDF, email the respondent,
 * notify staff and record the outcome. Every problem is detected before any file is
 * created where possible, so a typo in a template does not leave stray PDFs behind.
 */
import type { DocumentService, PdfFile } from "../adapters/document";
import type { ResponseData } from "../adapters/form";
import type { LogWriter } from "../adapters/log-sheet";
import type { Mailer } from "../adapters/mail";
import type { StateStore } from "../adapters/properties";
import { formatDateTime, type LocalDateTime } from "./datetime";
import { fail, ok, type Result } from "./result";
import { isEmail, type Settings } from "./settings";
import { buildFields, type FieldMap, renderTemplate, resolvePlaceholders } from "./template";

export interface ProcessDeps {
  loadSettings: () => Result<Settings>;
  documents: DocumentService;
  mailer: Mailer;
  log: LogWriter;
  state: StateStore;
  now: () => LocalDateTime;
}

export interface ProcessOutcome {
  ok: boolean;
  respondent: string;
  pdf?: PdfFile;
  errors: string[];
}

/** Warn staff once a day when fewer emails than this can still be sent. */
export const QUOTA_WARNING_THRESHOLD = 10;
const QUOTA_WARNED_KEY = "quotaWarnedOn";

export function processResponse(response: ResponseData, deps: ProcessDeps): ProcessOutcome {
  const settings = deps.loadSettings();
  const outcome = settings.ok
    ? generateAndSend(response, settings.value, deps)
    : {
        ok: false,
        respondent: response.respondentEmail,
        errors: settings.errors.map((e) => `設定シート：${e}`),
      };
  const staff = settings.ok ? settings.value.staffEmails : [];

  const notes: string[] = [];
  try {
    notifyStaff(outcome, response.responseId, staff, deps.mailer);
  } catch {
    notes.push("担当者への通知メールの送信に失敗しました");
  }

  deps.log.append({
    responseId: response.responseId,
    respondent: outcome.respondent,
    pdfUrl: outcome.pdf?.url ?? "",
    status: outcome.ok ? "成功" : "失敗",
    error: [...outcome.errors, ...notes].join("\n"),
  });

  try {
    warnIfQuotaLow(staff, deps);
  } catch {
    // The warning is best effort; the response itself has already been handled.
  }
  return outcome;
}

function generateAndSend(
  response: ResponseData,
  settings: Settings,
  deps: ProcessDeps,
): ProcessOutcome {
  const fields = buildFields({
    answers: response.answers,
    today: deps.now(),
    submittedAt: response.submittedAt,
  });

  const recipient = resolveRecipient(settings, response);
  const fileName = renderFileName(settings.fileNameTemplate, fields);
  const subject = renderTemplate(settings.subjectTemplate, fields);
  const body = renderTemplate(settings.bodyTemplate, fields);
  const templateText = attempt(
    () => deps.documents.readTemplateText(settings.templateDocId),
    "テンプレートのドキュメントを開けませんでした。ドキュメントIDと、このアカウントに閲覧権限があるかを確認してください",
  );
  const replacements: Result<ReadonlyMap<string, string>> = templateText.ok
    ? resolvePlaceholders(templateText.value, fields)
    : fail();

  const respondent = recipient.ok ? recipient.value : response.respondentEmail;
  if (!recipient.ok || !fileName.ok || !subject.ok || !body.ok || !replacements.ok) {
    return {
      ok: false,
      respondent,
      errors: [
        ...errorsOf(recipient, "回答者のメールアドレス"),
        ...errorsOf(fileName, "ファイル名テンプレート"),
        ...errorsOf(subject, "件名テンプレート"),
        ...errorsOf(body, "本文テンプレート"),
        ...(templateText.ok
          ? errorsOf(replacements, "テンプレートのドキュメント")
          : templateText.errors),
      ],
    };
  }

  const pdf = attempt(
    () =>
      deps.documents.createPdf({
        templateDocId: settings.templateDocId,
        folderId: settings.outputFolderId,
        fileName: fileName.value,
        replacements: replacements.value,
      }),
    "PDFの作成に失敗しました。保存先フォルダIDと、このアカウントに編集権限があるかを確認してください",
  );
  if (!pdf.ok) return { ok: false, respondent, errors: pdf.errors };

  const sent = attempt(
    () =>
      deps.mailer.send({
        to: [recipient.value],
        subject: subject.value.replace(/\s*\n\s*/g, " "),
        body: body.value,
        attachmentFileIds: [pdf.value.id],
      }),
    "回答者へのメール送信に失敗しました",
  );
  if (!sent.ok) return { ok: false, respondent, pdf: pdf.value, errors: sent.errors };

  return { ok: true, respondent, pdf: pdf.value, errors: [] };
}

function resolveRecipient(settings: Settings, response: ResponseData): Result<string> {
  if (settings.emailFieldName === "") {
    const email = response.respondentEmail.trim();
    if (isEmail(email)) return ok(email);
    return fail(
      "回答者のメールアドレスを取得できませんでした。フォームの設定で「メールアドレスを収集する」をオンにするか、設定シートに「回答者のメールアドレスの項目名」を入力してください",
    );
  }
  const answer = response.answers.get(settings.emailFieldName);
  if (answer === undefined) {
    return fail(`フォームに「${settings.emailFieldName}」という質問が見つかりません`);
  }
  const email = typeof answer === "string" ? answer.trim() : "";
  if (isEmail(email)) return ok(email);
  return fail(`「${settings.emailFieldName}」の回答がメールアドレスの形式ではありません`);
}

function renderFileName(template: string, fields: FieldMap): Result<string> {
  const rendered = renderTemplate(template, fields);
  if (!rendered.ok) return rendered;
  const name = rendered.value
    .replace(/[\r\n\t]+/g, " ")
    .trim()
    .replace(/\.pdf$/i, "");
  return name === "" ? fail("ファイル名が空になりました") : ok(name);
}

function notifyStaff(
  outcome: ProcessOutcome,
  responseId: string,
  staff: readonly string[],
  mailer: Mailer,
): void {
  if (outcome.ok) {
    if (staff.length === 0) return;
    mailer.send({
      to: staff,
      subject: `【書類送信】${outcome.pdf?.name ?? ""}`,
      body: [
        "フォームの回答から書類を作成し、回答者へ送信しました。",
        "",
        `送信先：${outcome.respondent}`,
        `ファイル：${outcome.pdf?.name ?? ""}`,
        `URL：${outcome.pdf?.url ?? ""}`,
      ].join("\n"),
    });
    return;
  }
  mailer.send({
    to: staff.length > 0 ? staff : [mailer.ownerEmail()],
    subject: "【要確認】書類の自動送信に失敗しました",
    body: [
      "フォームの回答の処理に失敗しました。下記のエラーを確認し、原因を直してから再送してください。",
      "処理の結果は、スプレッドシートの「記録」シートでも確認できます。",
      "",
      `回答ID：${responseId}`,
      "エラー：",
      ...outcome.errors.map((e) => `・${e}`),
    ].join("\n"),
  });
}

function warnIfQuotaLow(staff: readonly string[], deps: ProcessDeps): void {
  const remaining = deps.mailer.remainingDailyQuota();
  const today = formatDateTime(deps.now(), "yyyy-MM-dd");
  if (remaining >= QUOTA_WARNING_THRESHOLD || remaining <= 0) return;
  if (deps.state.get(QUOTA_WARNED_KEY) === today) return;
  deps.mailer.send({
    to: staff.length > 0 ? staff : [deps.mailer.ownerEmail()],
    subject: "【注意】メール送信数が1日の上限に近づいています",
    body: [
      `本日送信できるメールは、残り ${remaining} 通です。`,
      "上限に達すると、回答者へ書類を送れなくなります（送れなかった分は「記録」シートに「失敗」として残ります）。",
      "上限は、およそ24時間たつと回復します。",
    ].join("\n"),
  });
  deps.state.set(QUOTA_WARNED_KEY, today);
}

/** Runs a GAS call and turns an exception into a user-facing error. */
function attempt<T>(fn: () => T, message: string): Result<T> {
  try {
    return ok(fn());
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return fail(`${message}（詳細：${detail}）`);
  }
}

function errorsOf(result: Result<unknown>, label: string): string[] {
  return result.ok ? [] : result.errors.map((e) => `${label}：${e}`);
}
