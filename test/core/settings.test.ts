import { describe, expect, it } from "vitest";
import type { SheetReader } from "../../src/adapters/spreadsheet";
import { extractGoogleId, loadSettings, parseSettings } from "../../src/core/settings";

const DOC_ID = "1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789";
const FOLDER_ID = "1XyZ_abc-DEF0123456789";

const validRows = (): unknown[][] => [
  ["項目", "値", "説明"],
  ["テンプレートのドキュメントID", DOC_ID, "コピー元のドキュメント"],
  ["保存先フォルダID", FOLDER_ID],
  ["ファイル名テンプレート", "見積書_{{会社名}}_{{今日:date(yyyyMMdd)}}"],
  ["回答者のメールアドレスの項目名", "メールアドレス"],
  ["件名テンプレート", "{{お名前}} 様 お見積書を送付します"],
  ["本文テンプレート", "{{お名前}} 様\n\nお見積書を添付します。"],
  ["担当者のメールアドレス", ""],
];

const replaceValue = (rows: unknown[][], label: string, value: unknown) =>
  rows.map((row) => (row[0] === label ? [label, value] : row));

describe("parseSettings", () => {
  it("reads a valid sheet", () => {
    expect(parseSettings(validRows())).toEqual({
      ok: true,
      value: {
        templateDocId: DOC_ID,
        outputFolderId: FOLDER_ID,
        fileNameTemplate: "見積書_{{会社名}}_{{今日:date(yyyyMMdd)}}",
        emailFieldName: "メールアドレス",
        subjectTemplate: "{{お名前}} 様 お見積書を送付します",
        bodyTemplate: "{{お名前}} 様\n\nお見積書を添付します。",
        staffEmails: [],
      },
    });
  });

  it("ignores blank rows and row order, and allows the optional item to be omitted", () => {
    const rows = validRows().filter((row) => row[0] !== "担当者のメールアドレス");
    rows.reverse();
    rows.splice(2, 0, ["", ""], []);
    expect(parseSettings(rows).ok).toBe(true);
  });

  it("leaves the respondent email item empty to use the address collected by the form", () => {
    const rows = validRows().filter((row) => row[0] !== "回答者のメールアドレスの項目名");
    expect(parseSettings(rows)).toMatchObject({ ok: true, value: { emailFieldName: "" } });
  });

  it("extracts IDs from pasted URLs", () => {
    let rows = replaceValue(
      validRows(),
      "テンプレートのドキュメントID",
      `https://docs.google.com/document/d/${DOC_ID}/edit?tab=t.0`,
    );
    rows = replaceValue(
      rows,
      "保存先フォルダID",
      `https://drive.google.com/drive/folders/${FOLDER_ID}?usp=sharing`,
    );
    expect(parseSettings(rows)).toMatchObject({
      ok: true,
      value: { templateDocId: DOC_ID, outputFolderId: FOLDER_ID },
    });
  });

  it("accepts several staff addresses", () => {
    const rows = replaceValue(
      validRows(),
      "担当者のメールアドレス",
      "a@example.com, b@example.co.jp",
    );
    expect(parseSettings(rows)).toMatchObject({
      ok: true,
      value: { staffEmails: ["a@example.com", "b@example.co.jp"] },
    });
  });

  it("lists every missing required item", () => {
    const rows = replaceValue(validRows(), "件名テンプレート", "  ").filter(
      (row) => row[0] !== "保存先フォルダID",
    );
    expect(parseSettings(rows)).toEqual({
      ok: false,
      errors: [
        "「保存先フォルダID」が入力されていません",
        "「件名テンプレート」が入力されていません",
      ],
    });
  });

  it("reports unknown and duplicated items with row numbers", () => {
    const rows = [...validRows(), ["テンプレートID", "x"], ["件名テンプレート", "重複"]];
    expect(parseSettings(rows)).toEqual({
      ok: false,
      errors: [
        "9行目：「テンプレートID」は設定項目ではありません。A列の項目名を確認してください",
        "10行目：「件名テンプレート」が複数の行にあります。1行にまとめてください",
      ],
    });
  });

  it("validates IDs, template syntax and emails without echoing values", () => {
    let rows = replaceValue(validRows(), "保存先フォルダID", "secret-folder");
    rows = replaceValue(rows, "本文テンプレート", "{{お名前} 様");
    rows = replaceValue(rows, "担当者のメールアドレス", "staff-at-example");
    const result = parseSettings(rows);
    expect(result).toEqual({
      ok: false,
      errors: [
        "3行目：保存先フォルダIDの形式が正しくありません（フォルダのURLをそのまま貼っても構いません）",
        "7行目（本文テンプレート）：{{ と }} の対応が取れていない箇所があります",
        "8行目：担当者のメールアドレスの形式が正しくありません（複数の場合は「,」で区切ってください）",
      ],
    });
    expect(JSON.stringify(result)).not.toContain("staff-at-example");
  });

  it("rejects cells that are not text, such as dates", () => {
    const rows = replaceValue(validRows(), "件名テンプレート", new Date());
    expect(parseSettings(rows)).toMatchObject({
      ok: false,
      errors: [expect.stringContaining("6行目")],
    });
  });
});

describe("loadSettings", () => {
  it("reads the 設定 sheet through the reader", () => {
    const reader: SheetReader = {
      readSheet: (name) => (name === "設定" ? validRows() : undefined),
    };
    expect(loadSettings(reader).ok).toBe(true);
  });

  it("explains when the sheet is missing", () => {
    const reader: SheetReader = { readSheet: () => undefined };
    expect(loadSettings(reader)).toEqual({
      ok: false,
      errors: ["「設定」シートが見つかりません。シート名を確認してください"],
    });
  });
});

describe("extractGoogleId", () => {
  it("rejects text that is not an ID", () => {
    expect(extractGoogleId("abc")).toBeUndefined();
    expect(extractGoogleId("https://example.com/")).toBeUndefined();
  });
});
