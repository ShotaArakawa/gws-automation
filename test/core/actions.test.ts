import { describe, expect, it, vi } from "vitest";
import type { ResponseData } from "../../src/adapters/form";
import type { LogEntry, LogRow, LogStatus } from "../../src/adapters/log-sheet";
import type { MailMessage } from "../../src/adapters/mail";
import {
  type ActionDeps,
  MAX_RETRIES_PER_RUN,
  runRetryFailed,
  runSetup,
  runTestSend,
} from "../../src/core/actions";
import type { LocalDateTime } from "../../src/core/datetime";
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

const settings: Settings = {
  templateDocId: "template-doc",
  outputFolderId: "output-folder",
  fileNameTemplate: "見積書_{{お名前}}",
  emailFieldName: "メールアドレス",
  subjectTemplate: "{{お名前}} 様",
  bodyTemplate: "本文",
  staffEmails: [],
};

const response = (responseId: string, email = "taro@example.com"): ResponseData => ({
  responseId,
  answers: new Map([
    ["お名前", "山田 太郎"],
    ["メールアドレス", email],
  ]),
  respondentEmail: "",
  submittedAt: now,
});

function setup(
  options: { settingsSheet?: boolean; responses?: ResponseData[]; logRows?: LogRow[] } = {},
) {
  const alerts: { title: string; message: string }[] = [];
  const sent: MailMessage[] = [];
  const appended: LogEntry[] = [];
  const statuses = new Map<number, LogStatus>();
  const responses = options.responses ?? [response("r1")];
  const deps: ActionDeps = {
    loadSettings: () => ok(settings),
    documents: {
      readTemplateText: () => "{{お名前}}",
      createPdf: vi.fn(({ fileName }) => ({
        id: "pdf",
        name: `${fileName}.pdf`,
        url: "https://pdf",
      })),
    },
    mailer: {
      send: (message) => sent.push(message),
      remainingDailyQuota: () => 100,
      ownerEmail: () => "me@example.com",
    },
    log: {
      append: (entry) => appended.push(entry),
      readRows: () => options.logRows ?? [],
      setStatus: (row, status) => statuses.set(row, status),
    },
    state: { get: () => undefined, set: () => {} },
    now: () => now,
    sheets: {
      readSheet: () => (options.settingsSheet === false ? undefined : []),
      createSheet: vi.fn(),
    },
    forms: {
      latestResponse: () => responses[responses.length - 1],
      responseById: (id) => responses.find((r) => r.responseId === id),
      installSubmitTrigger: vi.fn(),
    },
    ui: {
      alert: (title, message) => alerts.push({ title, message }),
      confirm: vi.fn(() => true),
    },
  };
  return { deps, alerts, sent, appended, statuses };
}

describe("runSetup", () => {
  it("creates the settings sheet when it is missing and stops there", () => {
    const { deps, alerts } = setup({ settingsSheet: false });
    runSetup(deps);
    expect(deps.sheets.createSheet).toHaveBeenCalledWith(
      "設定",
      expect.arrayContaining([["項目", "値", "説明"]]),
    );
    expect(deps.forms.installSubmitTrigger).not.toHaveBeenCalled();
    expect(alerts[0]?.title).toBe("「設定」シートを作成しました");
  });

  it("shows settings errors without installing the trigger", () => {
    const { deps, alerts } = setup();
    deps.loadSettings = () => fail("「保存先フォルダID」が入力されていません");
    runSetup(deps);
    expect(deps.forms.installSubmitTrigger).not.toHaveBeenCalled();
    expect(alerts[0]).toEqual({
      title: "設定に不備があります",
      message: "・「保存先フォルダID」が入力されていません",
    });
  });

  it("installs the trigger for onFormSubmit", () => {
    const { deps, alerts } = setup();
    runSetup(deps);
    expect(deps.forms.installSubmitTrigger).toHaveBeenCalledWith("onFormSubmit");
    expect(alerts[0]?.title).toBe("初期設定が完了しました");
  });

  it("explains when no form is linked", () => {
    const { deps, alerts } = setup();
    deps.forms.installSubmitTrigger = () => {
      throw new Error("フォームがありません");
    };
    runSetup(deps);
    expect(alerts[0]).toEqual({
      title: "初期設定を完了できませんでした",
      message: "フォームがありません",
    });
  });
});

describe("runTestSend", () => {
  it("sends the latest response to the person running it, without logging", () => {
    const { deps, alerts, sent, appended } = setup({
      responses: [response("r1", "first@example.com"), response("r2", "latest@example.com")],
    });

    runTestSend(deps);

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ to: ["me@example.com"], subject: "【テスト】山田 太郎 様" });
    expect(sent[0]?.body).toContain("本番では latest@example.com 宛に送信されます");
    expect(deps.documents.createPdf).toHaveBeenCalledWith(
      expect.objectContaining({ fileName: "テスト_見積書_山田 太郎" }),
    );
    expect(appended).toEqual([]);
    expect(alerts[0]?.title).toBe("テスト送信しました");
    expect(alerts[0]?.message).toContain("テスト_見積書_山田 太郎.pdf");
  });

  it("asks for a response when the form has none", () => {
    const { deps, alerts, sent } = setup({ responses: [] });
    runTestSend(deps);
    expect(sent).toEqual([]);
    expect(alerts[0]?.message).toContain("フォームの回答がまだありません");
  });

  it("shows processing errors", () => {
    const { deps, alerts } = setup({ responses: [response("r1", "not-an-email")] });
    runTestSend(deps);
    expect(alerts[0]?.title).toBe("テスト送信できませんでした");
    expect(alerts[0]?.message).toContain("メールアドレスの形式ではありません");
  });
});

describe("runRetryFailed", () => {
  it("resends failed responses, logs the new result and marks the old rows", () => {
    const { deps, alerts, sent, appended, statuses } = setup({
      responses: [response("r1"), response("r2")],
      logRows: [
        { row: 2, responseId: "r1", status: "失敗" },
        { row: 3, responseId: "r2", status: "成功" },
      ],
    });

    runRetryFailed(deps);

    expect(sent.map((m) => m.to)).toEqual([["taro@example.com"]]);
    expect(appended).toMatchObject([{ responseId: "r1", status: "成功" }]);
    expect(statuses).toEqual(new Map([[2, "再送済み"]]));
    expect(alerts[0]).toEqual({ title: "再送が終わりました", message: "成功：1 件\n失敗：0 件" });
  });

  it("does nothing when there is nothing to resend", () => {
    const { deps, alerts } = setup({ logRows: [{ row: 2, responseId: "r1", status: "成功" }] });
    runRetryFailed(deps);
    expect(deps.ui.confirm).not.toHaveBeenCalled();
    expect(alerts[0]?.title).toBe("再送する回答はありません");
  });

  it("does nothing when the person cancels", () => {
    const { deps, sent, statuses } = setup({
      logRows: [{ row: 2, responseId: "r1", status: "失敗" }],
    });
    deps.ui.confirm = () => false;
    runRetryFailed(deps);
    expect(sent).toEqual([]);
    expect(statuses.size).toBe(0);
  });

  it("reports responses deleted from the form and leaves their rows as failed", () => {
    const { deps, alerts, statuses } = setup({
      logRows: [{ row: 2, responseId: "gone", status: "失敗" }],
    });
    runRetryFailed(deps);
    expect(statuses.size).toBe(0);
    expect(alerts[0]?.message).toContain("回答が見つからない：1 件");
  });

  it("processes a limited number per run and says how many remain", () => {
    const count = MAX_RETRIES_PER_RUN + 3;
    const ids = Array.from({ length: count }, (_, i) => `r${i}`);
    const { deps, alerts, appended } = setup({
      responses: ids.map((id) => response(id)),
      logRows: ids.map((id, i) => ({ row: i + 2, responseId: id, status: "失敗" })),
    });

    runRetryFailed(deps);

    expect(appended).toHaveLength(MAX_RETRIES_PER_RUN);
    expect(alerts[0]?.message).toContain("未処理の失敗が 3 件あります");
  });
});
