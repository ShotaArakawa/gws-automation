export const LOG_SHEET_NAME = "記録";
export const LOG_HEADER = [
  "処理日時",
  "回答ID",
  "回答者",
  "PDFのURL",
  "結果",
  "エラー内容",
] as const;

/** 「再送済み」 marks a failed row that has been retried; the retry adds its own row. */
export type LogStatus = "成功" | "失敗" | "再送済み";

export interface LogEntry {
  responseId: string;
  respondent: string;
  pdfUrl: string;
  status: LogStatus;
  error: string;
}

export interface LogWriter {
  append(entry: LogEntry): void;
}

/** A data row of the log sheet. `row` is the 1-based sheet row number. */
export interface LogRow {
  row: number;
  responseId: string;
  status: string;
}

export interface LogSheet extends LogWriter {
  readRows(): LogRow[];
  setStatus(row: number, status: LogStatus): void;
}

const RESPONSE_ID_COLUMN = LOG_HEADER.indexOf("回答ID") + 1;
const STATUS_COLUMN = LOG_HEADER.indexOf("結果") + 1;

/** The 「記録」 sheet, created with a header row on the first append. */
export function createGasLogSheet(
  spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet = SpreadsheetApp.getActiveSpreadsheet(),
): LogSheet {
  return {
    append(entry) {
      let sheet = spreadsheet.getSheetByName(LOG_SHEET_NAME);
      if (sheet === null) {
        sheet = spreadsheet.insertSheet(LOG_SHEET_NAME);
        sheet.appendRow([...LOG_HEADER]);
        sheet.setFrozenRows(1);
      }
      sheet.appendRow([
        new Date(),
        entry.responseId,
        entry.respondent,
        entry.pdfUrl,
        entry.status,
        entry.error,
      ]);
    },

    readRows() {
      const sheet = spreadsheet.getSheetByName(LOG_SHEET_NAME);
      if (sheet === null || sheet.getLastRow() < 2) return [];
      return sheet
        .getRange(2, 1, sheet.getLastRow() - 1, LOG_HEADER.length)
        .getValues()
        .map((cells, index) => ({
          row: index + 2,
          responseId: String(cells[RESPONSE_ID_COLUMN - 1] ?? ""),
          status: String(cells[STATUS_COLUMN - 1] ?? ""),
        }));
    },

    setStatus(row, status) {
      spreadsheet.getSheetByName(LOG_SHEET_NAME)?.getRange(row, STATUS_COLUMN).setValue(status);
    },
  };
}
