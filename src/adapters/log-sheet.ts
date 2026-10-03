export const LOG_SHEET_NAME = "記録";
export const LOG_HEADER = [
  "処理日時",
  "回答ID",
  "回答者",
  "PDFのURL",
  "結果",
  "エラー内容",
] as const;

export type LogStatus = "成功" | "失敗";

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

/** Appends to the 「記録」 sheet, creating it with a header row when it does not exist. */
export function createGasLogWriter(
  spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet = SpreadsheetApp.getActiveSpreadsheet(),
): LogWriter {
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
  };
}
