/**
 * Reads and validates the 「設定」 sheet.
 *
 * Layout: column A is the item name, column B its value. A header row whose A column is
 * 「項目」 and blank rows are skipped. Error messages never echo cell values, because they
 * may end up in logs.
 */
import type { SheetReader } from "../adapters/spreadsheet";
import { fail, ok, type Result } from "./result";
import { checkTemplateSyntax } from "./template";

export const SETTINGS_SHEET_NAME = "設定";

export interface Settings {
  templateDocId: string;
  outputFolderId: string;
  fileNameTemplate: string;
  /** Question holding the respondent's address. Empty: use the address collected by the form. */
  emailFieldName: string;
  subjectTemplate: string;
  bodyTemplate: string;
  /** Empty when no staff notification is configured. */
  staffEmails: string[];
}

type Key = keyof Settings;

/** Text values of the settings sheet, by item; omitted items are left empty. */
export type SettingsValues = Partial<Record<Key, string>>;

interface ItemSpec {
  key: Key;
  label: string;
  required: boolean;
  /** Shown in column C of a newly created settings sheet. */
  description: string;
}

const ITEMS: readonly ItemSpec[] = [
  {
    key: "templateDocId",
    label: "テンプレートのドキュメントID",
    required: true,
    description: "【必須】書類のひな形の Google ドキュメント。URL をそのまま貼っても構いません",
  },
  {
    key: "outputFolderId",
    label: "保存先フォルダID",
    required: true,
    description:
      "【必須】PDF を保存する Google ドライブのフォルダ。URL をそのまま貼っても構いません",
  },
  {
    key: "fileNameTemplate",
    label: "ファイル名テンプレート",
    required: true,
    description: "【必須】例：見積書_{{会社名}}_{{今日:date(yyyyMMdd)}}",
  },
  {
    key: "emailFieldName",
    label: "回答者のメールアドレスの項目名",
    required: false,
    description:
      "メールアドレスを聞く質問のタイトル。空欄の場合は、フォームの「メールアドレスを収集する」で集めたアドレスを使います",
  },
  {
    key: "subjectTemplate",
    label: "件名テンプレート",
    required: true,
    description: "【必須】例：{{お名前}} 様 お見積書を送付します",
  },
  {
    key: "bodyTemplate",
    label: "本文テンプレート",
    required: true,
    description: "【必須】メール本文。セル内の改行は Alt+Enter（Mac は ⌘+Enter）",
  },
  {
    key: "staffEmails",
    label: "担当者のメールアドレス",
    required: false,
    description: "送信の通知とエラーを受け取るアドレス。複数ある場合は「,」で区切ります",
  },
];

const HEADER_LABEL = "項目";

/** Rows for a settings sheet: header, then one row per item with the given values. */
export function settingsSheetTemplate(values: SettingsValues = {}): string[][] {
  return [
    [HEADER_LABEL, "値", "説明"],
    ...ITEMS.map((item) => [item.label, values[item.key] ?? "", item.description]),
  ];
}

export function loadSettings(reader: SheetReader): Result<Settings> {
  const rows = reader.readSheet(SETTINGS_SHEET_NAME);
  if (rows === undefined) {
    return fail(`「${SETTINGS_SHEET_NAME}」シートが見つかりません。シート名を確認してください`);
  }
  return parseSettings(rows);
}

export function parseSettings(rows: readonly (readonly unknown[])[]): Result<Settings> {
  const errors: string[] = [];
  const values = new Map<Key, { text: string; row: number }>();
  const invalidKeys = new Set<Key>();

  rows.forEach((cells, index) => {
    const row = index + 1;
    const label = cellText(cells[0]);
    if (label === undefined || label === "" || label === HEADER_LABEL) return;

    const item = ITEMS.find((it) => it.label === label);
    if (item === undefined) {
      errors.push(
        `${row}行目：「${label}」は設定項目ではありません。A列の項目名を確認してください`,
      );
      return;
    }
    if (values.has(item.key) || invalidKeys.has(item.key)) {
      errors.push(`${row}行目：「${label}」が複数の行にあります。1行にまとめてください`);
      return;
    }
    const text = cellText(cells[1]);
    if (text === undefined) {
      errors.push(`${row}行目：「${label}」の値は文字で入力してください`);
      invalidKeys.add(item.key);
      return;
    }
    values.set(item.key, { text, row });
  });

  for (const item of ITEMS) {
    if (item.required && !invalidKeys.has(item.key) && !values.get(item.key)?.text) {
      errors.push(`「${item.label}」が入力されていません`);
    }
  }
  if (errors.length > 0) return fail(...errors);

  const get = (key: Key) => values.get(key)?.text ?? "";
  const rowOf = (key: Key) => values.get(key)?.row ?? 0;

  const templateDocId = extractGoogleId(get("templateDocId"));
  if (templateDocId === undefined) {
    errors.push(
      `${rowOf("templateDocId")}行目：テンプレートのドキュメントIDの形式が正しくありません（ドキュメントのURLをそのまま貼っても構いません）`,
    );
  }
  const outputFolderId = extractGoogleId(get("outputFolderId"));
  if (outputFolderId === undefined) {
    errors.push(
      `${rowOf("outputFolderId")}行目：保存先フォルダIDの形式が正しくありません（フォルダのURLをそのまま貼っても構いません）`,
    );
  }

  for (const key of ["fileNameTemplate", "subjectTemplate", "bodyTemplate"] as const) {
    const label = ITEMS.find((it) => it.key === key)?.label;
    for (const error of checkTemplateSyntax(get(key))) {
      errors.push(`${rowOf(key)}行目（${label}）：${error}`);
    }
  }

  const staffEmails = splitEmails(get("staffEmails"));
  if (staffEmails.some((email) => !isEmail(email))) {
    errors.push(
      `${rowOf("staffEmails")}行目：担当者のメールアドレスの形式が正しくありません（複数の場合は「,」で区切ってください）`,
    );
  }

  if (errors.length > 0 || templateDocId === undefined || outputFolderId === undefined) {
    return fail(...errors);
  }
  return ok({
    templateDocId,
    outputFolderId,
    fileNameTemplate: get("fileNameTemplate"),
    emailFieldName: get("emailFieldName"),
    subjectTemplate: get("subjectTemplate"),
    bodyTemplate: get("bodyTemplate"),
    staffEmails,
  });
}

/** Spreadsheet cells come back as string, number, boolean or Date. Only text and numbers are accepted. */
function cellText(cell: unknown): string | undefined {
  if (cell === undefined || cell === null) return "";
  if (typeof cell === "string") return cell.trim();
  if (typeof cell === "number") return String(cell);
  return undefined;
}

const ID_PATTERN = /^[-\w]{20,}$/;
const ID_IN_URL = /\/(?:d|folders)\/([-\w]{20,})/;

/** Accepts a bare Drive file/folder ID or a URL that contains one. */
export function extractGoogleId(text: string): string | undefined {
  if (ID_PATTERN.test(text)) return text;
  return ID_IN_URL.exec(text)?.[1];
}

function splitEmails(text: string): string[] {
  return text
    .split(/[,、，\s]+/)
    .map((s) => s.trim())
    .filter((s) => s !== "");
}

export function isEmail(text: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
}
