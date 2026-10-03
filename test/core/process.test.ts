import { describe, expect, it, vi } from "vitest";
import type { DocumentService } from "../../src/adapters/document";
import type { ResponseData } from "../../src/adapters/form";
import type { LogEntry } from "../../src/adapters/log-sheet";
import type { Mailer, MailMessage } from "../../src/adapters/mail";
import type { LocalDateTime } from "../../src/core/datetime";
import { type ProcessDeps, processResponse } from "../../src/core/process";
import { fail, ok } from "../../src/core/result";
import type { Settings } from "../../src/core/settings";

const now: LocalDateTime = {
  year: 2026,
  month: 10,
  day: 3,
  hour: 10,
  minute: 0,
  second: 0,
  hasTime: true,
};

const baseSettings: Settings = {
  templateDocId: "template-doc",
  outputFolderId: "output-folder",
  fileNameTemplate: "見積書_{{会社名}}_{{今日:date(yyyyMMdd)}}",
  emailFieldName: "メールアドレス",
  subjectTemplate: "{{お名前}} 様 お見積書を送付します",
  bodyTemplate: "{{お名前}} 様\n合計 {{合計金額:yen}}",
  staffEmails: ["staff@example.com"],
};

const response = (overrides: Partial<ResponseData> = {}): ResponseData => ({
  responseId: "resp-1",
  answers: new Map([
    ["お名前", "山田 太郎"],
    ["会社名", "山田商店"],
    ["合計金額", "12000"],
    ["メールアドレス", "taro@example.com"],
  ]),
  respondentEmail: "",
  submittedAt: { ...now, hour: 9, minute: 58 },
  ...overrides,
});

function setup(
  options: {
    settings?: Partial<Settings>;
    templateText?: string;
    documents?: Partial<DocumentService>;
    send?: (message: MailMessage) => void;
    quota?: number;
  } = {},
) {
  const sent: MailMessage[] = [];
  const logs: LogEntry[] = [];
  const state = new Map<string, string>();
  const documents: DocumentService = {
    readTemplateText: vi.fn(() => options.templateText ?? "{{会社名}} 御中 {{合計金額:yen}}"),
    createPdf: vi.fn(({ fileName }) => ({
      id: "pdf-1",
      name: `${fileName}.pdf`,
      url: "https://drive.google.com/file/d/pdf-1",
    })),
    ...options.documents,
  };
  const mailer: Mailer = {
    send: (message) => {
      options.send?.(message);
      sent.push(message);
    },
    remainingDailyQuota: () => options.quota ?? 90,
    ownerEmail: () => "owner@example.com",
  };
  const deps: ProcessDeps = {
    loadSettings: () => ok({ ...baseSettings, ...options.settings }),
    documents,
    mailer,
    log: { append: (entry) => logs.push(entry) },
    state: { get: (key) => state.get(key), set: (key, value) => state.set(key, value) },
    now: () => now,
  };
  return { deps, documents, sent, logs, state };
}

describe("processResponse", () => {
  it("creates the PDF, emails the respondent, notifies staff and records success", () => {
    const { deps, documents, sent, logs } = setup();

    const outcome = processResponse(response(), deps);

    expect(outcome.ok).toBe(true);
    expect(documents.createPdf).toHaveBeenCalledWith({
      templateDocId: "template-doc",
      folderId: "output-folder",
      fileName: "見積書_山田商店_20261003",
      replacements: new Map([
        ["{{会社名}}", "山田商店"],
        ["{{合計金額:yen}}", "¥12,000"],
      ]),
    });
    expect(sent[0]).toEqual({
      to: ["taro@example.com"],
      subject: "山田 太郎 様 お見積書を送付します",
      body: "山田 太郎 様\n合計 ¥12,000",
      attachmentFileIds: ["pdf-1"],
    });
    expect(sent[1]).toMatchObject({
      to: ["staff@example.com"],
      subject: "【書類送信】見積書_山田商店_20261003.pdf",
    });
    expect(sent).toHaveLength(2);
    expect(logs).toEqual([
      {
        responseId: "resp-1",
        respondent: "taro@example.com",
        pdfUrl: "https://drive.google.com/file/d/pdf-1",
        status: "成功",
        error: "",
      },
    ]);
  });

  it("does not notify staff on success when no staff address is set", () => {
    const { deps, sent } = setup({ settings: { staffEmails: [] } });
    processResponse(response(), deps);
    expect(sent.map((m) => m.to)).toEqual([["taro@example.com"]]);
  });

  it("uses the address collected by the form when no question is configured", () => {
    const { deps, sent } = setup({ settings: { emailFieldName: "" } });
    processResponse(response({ respondentEmail: "collected@example.com" }), deps);
    expect(sent[0]?.to).toEqual(["collected@example.com"]);
  });

  it("fails without creating a file when no address can be determined", () => {
    const { deps, documents, sent, logs } = setup({
      settings: { emailFieldName: "", staffEmails: [] },
    });

    const outcome = processResponse(response(), deps);

    expect(outcome.ok).toBe(false);
    expect(outcome.errors[0]).toContain("メールアドレスを収集する");
    expect(documents.createPdf).not.toHaveBeenCalled();
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      to: ["owner@example.com"],
      subject: "【要確認】書類の自動送信に失敗しました",
    });
    expect(sent[0]?.body).toContain("回答ID：resp-1");
    expect(logs[0]).toMatchObject({ status: "失敗", respondent: "", pdfUrl: "" });
  });

  it("rejects an answer that is not an email address", () => {
    const answers = new Map(response().answers);
    answers.set("メールアドレス", "taro");
    const { deps } = setup();
    expect(processResponse(response({ answers }), deps).errors).toEqual([
      "回答者のメールアドレス：「メールアドレス」の回答がメールアドレスの形式ではありません",
    ]);
  });

  it("reports every template problem before creating any file", () => {
    const { deps, documents, logs } = setup({
      settings: { subjectTemplate: "{{氏名}} 様" },
      templateText: "{{会社名称}} 御中",
    });

    const outcome = processResponse(response(), deps);

    expect(outcome.errors).toEqual([
      "件名テンプレート：{{氏名}}：フォームに「氏名」という質問が見つかりません",
      "テンプレートのドキュメント：{{会社名称}}：フォームに「会社名称」という質問が見つかりません",
    ]);
    expect(documents.createPdf).not.toHaveBeenCalled();
    expect(logs[0]?.error).toBe(outcome.errors.join("\n"));
  });

  it("explains when the template document cannot be opened", () => {
    const { deps } = setup({
      documents: {
        readTemplateText: () => {
          throw new Error("No item with the given ID could be found");
        },
      },
    });
    expect(processResponse(response(), deps).errors).toEqual([
      "テンプレートのドキュメントを開けませんでした。ドキュメントIDと、このアカウントに閲覧権限があるかを確認してください（詳細：No item with the given ID could be found）",
    ]);
  });

  it("reports settings errors and notifies the owner", () => {
    const { deps, sent, logs } = setup();
    deps.loadSettings = () => fail("「保存先フォルダID」が入力されていません");

    const outcome = processResponse(response(), deps);

    expect(outcome.errors).toEqual(["設定シート：「保存先フォルダID」が入力されていません"]);
    expect(sent[0]?.to).toEqual(["owner@example.com"]);
    expect(logs[0]?.status).toBe("失敗");
  });

  it("does not email the respondent when the PDF cannot be created", () => {
    const { deps, sent } = setup({
      documents: {
        createPdf: () => {
          throw new Error("Access denied: DriveApp.");
        },
      },
    });

    const outcome = processResponse(response(), deps);

    expect(outcome.errors[0]).toMatch(/^PDFの作成に失敗しました/);
    expect(sent.map((m) => m.to)).toEqual([["staff@example.com"]]);
  });

  it("records the PDF URL when sending to the respondent fails", () => {
    const { deps, logs, sent } = setup({
      send: (message) => {
        if (message.to.includes("taro@example.com")) throw new Error("Invalid email");
      },
    });

    const outcome = processResponse(response(), deps);

    expect(outcome.ok).toBe(false);
    expect(logs[0]).toMatchObject({
      status: "失敗",
      pdfUrl: "https://drive.google.com/file/d/pdf-1",
      error: "回答者へのメール送信に失敗しました（詳細：Invalid email）",
    });
    expect(sent[sent.length - 1]?.subject).toBe("【要確認】書類の自動送信に失敗しました");
  });

  it("still records success when only the staff notification fails", () => {
    const { deps, logs } = setup({
      send: (message) => {
        if (message.to.includes("staff@example.com")) throw new Error("quota");
      },
    });
    processResponse(response(), deps);
    expect(logs[0]).toMatchObject({
      status: "成功",
      error: "担当者への通知メールの送信に失敗しました",
    });
  });

  it("cleans up the file name", () => {
    const { deps, documents } = setup({
      settings: { fileNameTemplate: " 見積書\n{{会社名}}.pdf " },
    });
    processResponse(response(), deps);
    expect(documents.createPdf).toHaveBeenCalledWith(
      expect.objectContaining({ fileName: "見積書 山田商店" }),
    );
  });

  it("warns once a day when the email quota is running low", () => {
    const { deps, sent, state } = setup({ quota: 5 });

    processResponse(response(), deps);
    processResponse(response(), deps);

    const warnings = sent.filter((m) => m.subject.startsWith("【注意】"));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ to: ["staff@example.com"] });
    expect(warnings[0]?.body).toContain("残り 5 通");
    expect(state.get("quotaWarnedOn")).toBe("2026-10-03");
  });

  it("does not warn while enough quota remains", () => {
    const { deps, sent } = setup({ quota: 10 });
    processResponse(response(), deps);
    expect(sent.some((m) => m.subject.startsWith("【注意】"))).toBe(false);
  });
});
