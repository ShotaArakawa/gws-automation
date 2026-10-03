/**
 * What the spreadsheet menu items do. Each action reports its result in a dialog, in
 * Japanese, because the person clicking is usually not an engineer.
 */
import type { FormService } from "../adapters/form";
import type { LogSheet } from "../adapters/log-sheet";
import type { SheetReader, SheetWriter } from "../adapters/spreadsheet";
import type { Ui } from "../adapters/ui";
import { type ProcessDeps, processResponse, processTestResponse } from "./process";
import { selectRetryTargets } from "./retry";
import { SETTINGS_SHEET_NAME, settingsSheetTemplate } from "./settings";

export interface ActionDeps extends ProcessDeps {
  log: LogSheet;
  sheets: SheetReader & SheetWriter;
  forms: FormService;
  ui: Ui;
}

export const FORM_SUBMIT_HANDLER = "onFormSubmit";

/** Responses resent per run, to stay well within the 6-minute execution limit. */
export const MAX_RETRIES_PER_RUN = 20;

export function runSetup(deps: ActionDeps): void {
  if (deps.sheets.readSheet(SETTINGS_SHEET_NAME) === undefined) {
    deps.sheets.createSheet(SETTINGS_SHEET_NAME, settingsSheetTemplate());
    deps.ui.alert(
      "「設定」シートを作成しました",
      "B列に値を入力してから、もう一度メニューの「初期設定」を実行してください。\n各項目の説明はC列にあります。",
    );
    return;
  }

  const settings = deps.loadSettings();
  if (!settings.ok) {
    deps.ui.alert("設定に不備があります", bulletList(settings.errors));
    return;
  }

  try {
    deps.forms.installSubmitTrigger(FORM_SUBMIT_HANDLER);
  } catch (error) {
    deps.ui.alert("初期設定を完了できませんでした", messageOf(error));
    return;
  }

  deps.ui.alert(
    "初期設定が完了しました",
    "フォームが送信されると、自動で書類を作成してメールで送ります。\n\nまずはメニューの「テスト送信」で、書類とメールの内容を確認してください。",
  );
}

export function runTestSend(deps: ActionDeps): void {
  let response: ReturnType<FormService["latestResponse"]>;
  try {
    response = deps.forms.latestResponse();
  } catch (error) {
    deps.ui.alert("テスト送信できませんでした", messageOf(error));
    return;
  }
  if (response === undefined) {
    deps.ui.alert(
      "テスト送信できませんでした",
      "フォームの回答がまだありません。フォームから 1 件回答してから、もう一度実行してください。",
    );
    return;
  }

  const recipient = deps.mailer.ownerEmail();
  const outcome = processTestResponse(response, deps, recipient);
  if (!outcome.ok) {
    deps.ui.alert("テスト送信できませんでした", bulletList(outcome.errors));
    return;
  }
  deps.ui.alert(
    "テスト送信しました",
    [
      "最新の回答 1 件で書類を作成し、あなた（実行したアカウント）宛に送信しました。",
      "",
      "メールと、保存先フォルダの「テスト_」で始まる PDF を確認してください。確認後、テスト用の PDF は削除して構いません。",
    ].join("\n"),
  );
}

export function runRetryFailed(deps: ActionDeps): void {
  const targets = selectRetryTargets(deps.log.readRows());
  if (targets.length === 0) {
    deps.ui.alert(
      "再送する回答はありません",
      "「記録」シートに、再送が必要な「失敗」の行はありません。",
    );
    return;
  }

  const batch = targets.slice(0, MAX_RETRIES_PER_RUN);
  const confirmed = deps.ui.confirm(
    "失敗分を再送します",
    [
      `失敗した回答 ${targets.length} 件を、もう一度処理して送信します。`,
      targets.length > batch.length
        ? `時間の制限があるため、今回は古い順に ${batch.length} 件を処理します。`
        : "",
      "設定やテンプレートの不備を直してから実行してください。よろしいですか？",
    ]
      .filter((line) => line !== "")
      .join("\n"),
  );
  if (!confirmed) return;

  let succeeded = 0;
  let failed = 0;
  let missing = 0;
  for (const target of batch) {
    const response = deps.forms.responseById(target.responseId);
    if (response === undefined) {
      missing++;
      continue;
    }
    if (processResponse(response, deps).ok) succeeded++;
    else failed++;
    for (const row of target.rows) deps.log.setStatus(row, "再送済み");
  }

  const remaining = targets.length - batch.length;
  deps.ui.alert(
    "再送が終わりました",
    [
      `成功：${succeeded} 件`,
      `失敗：${failed} 件`,
      missing > 0
        ? `回答が見つからない：${missing} 件（フォームから削除された可能性があります）`
        : "",
      remaining > 0
        ? `\n未処理の失敗が ${remaining} 件あります。もう一度「失敗分を再送」を実行してください。`
        : "",
      failed > 0 ? "\n失敗した理由は「記録」シートの「エラー内容」で確認できます。" : "",
    ]
      .filter((line) => line !== "")
      .join("\n"),
  );
}

function bulletList(errors: readonly string[]): string {
  return errors.map((e) => `・${e}`).join("\n");
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
