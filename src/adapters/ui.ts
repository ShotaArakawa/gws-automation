/** Dialogs shown in the spreadsheet. Only usable when a person runs a menu item. */
export interface Ui {
  alert(title: string, message: string): void;
  /** Returns true when the person answers 「はい」. */
  confirm(title: string, message: string): boolean;
}

export function createGasUi(): Ui {
  const ui = SpreadsheetApp.getUi();
  return {
    alert(title, message) {
      ui.alert(title, message, ui.ButtonSet.OK);
    },
    confirm(title, message) {
      return ui.alert(title, message, ui.ButtonSet.YES_NO) === ui.Button.YES;
    },
  };
}
