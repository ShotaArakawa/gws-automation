/**
 * Dialogs shown in the spreadsheet. Callers must not put personal data in messages,
 * because they go to the execution log when dialogs are unavailable.
 */
export interface Ui {
  alert(title: string, message: string): void;
  /** Returns true when the person answers 「はい」. */
  confirm(title: string, message: string): boolean;
}

export function createGasUi(): Ui {
  const ui = tryGetSpreadsheetUi();
  if (ui === undefined) return createLogUi();
  return {
    alert(title, message) {
      ui.alert(title, message, ui.ButtonSet.OK);
    },
    confirm(title, message) {
      return ui.alert(title, message, ui.ButtonSet.YES_NO) === ui.Button.YES;
    },
  };
}

/**
 * The spreadsheet UI, or undefined when there is none, e.g. when a function is run from
 * the Apps Script editor ("Cannot call SpreadsheetApp.getUi() from this context").
 */
export function tryGetSpreadsheetUi(): GoogleAppsScript.Base.Ui | undefined {
  try {
    return SpreadsheetApp.getUi();
  } catch {
    return undefined;
  }
}

/** Run from the editor: whoever pressed 「実行」 has already decided, so confirm says yes. */
function createLogUi(): Ui {
  return {
    alert(title, message) {
      console.log(`【${title}】\n${message}`);
    },
    confirm(title, message) {
      console.log(
        `【${title}】\n${message}\n（エディタから実行したため、「はい」として続行します）`,
      );
      return true;
    },
  };
}
