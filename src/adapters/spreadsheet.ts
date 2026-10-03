/** Read access to the bound spreadsheet. Core logic depends only on this interface. */
export interface SheetReader {
  /** All values of the sheet's data range, or undefined when no sheet has that name. */
  readSheet(name: string): unknown[][] | undefined;
}

export interface SheetWriter {
  /** Adds a sheet filled with the rows; the first row is formatted as a header. */
  createSheet(name: string, rows: readonly (readonly string[])[]): void;
}

export function createGasSheets(
  spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet = SpreadsheetApp.getActiveSpreadsheet(),
): SheetReader & SheetWriter {
  return {
    readSheet(name) {
      return spreadsheet.getSheetByName(name)?.getDataRange().getValues();
    },
    createSheet(name, rows) {
      const sheet = spreadsheet.insertSheet(name);
      const width = Math.max(...rows.map((row) => row.length));
      const values = rows.map((row) => [...row, ...Array<string>(width - row.length).fill("")]);
      sheet.getRange(1, 1, values.length, width).setValues(values).setVerticalAlignment("top");
      sheet.getRange(1, 1, 1, width).setFontWeight("bold").setBackground("#e8eaed");
      sheet.setFrozenRows(1);
      sheet.setColumnWidth(1, 240);
      sheet.setColumnWidth(2, 360);
      if (width >= 3) sheet.setColumnWidth(3, 480);
      sheet.getRange(1, 2, values.length, Math.max(width - 1, 1)).setWrap(true);
      spreadsheet.setActiveSheet(sheet);
    },
  };
}
