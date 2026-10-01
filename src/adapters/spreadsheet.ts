/** Read access to the bound spreadsheet. Core logic depends only on this interface. */
export interface SheetReader {
  /** All values of the sheet's data range, or undefined when no sheet has that name. */
  readSheet(name: string): unknown[][] | undefined;
}

export function createGasSheetReader(
  spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet = SpreadsheetApp.getActiveSpreadsheet(),
): SheetReader {
  return {
    readSheet(name) {
      return spreadsheet.getSheetByName(name)?.getDataRange().getValues();
    },
  };
}
