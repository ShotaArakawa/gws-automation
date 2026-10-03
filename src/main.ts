/**
 * Entry point bundled into dist/Code.js.
 *
 * Apps Script calls functions by name (triggers, menu items, editor runs), so every such
 * function must be exposed on globalThis. scripts/build.mjs detects them and adds top-level
 * declarations so they also appear in the Apps Script editor.
 */
import { createGasDocumentService } from "./adapters/document";
import { toLocalDateTime, toResponseData } from "./adapters/form";
import { createGasLogWriter } from "./adapters/log-sheet";
import { createGasMailer } from "./adapters/mail";
import { createGasStateStore } from "./adapters/properties";
import { createGasSheetReader } from "./adapters/spreadsheet";
import { type ProcessDeps, processResponse } from "./core/process";
import { loadSettings } from "./core/settings";

const FORM_SUBMIT_HANDLER = "onFormSubmit";

/** Run from the Apps Script editor to confirm that `pnpm push` updated the script. */
function healthCheck(): string {
  const message = "gws-automation is ready";
  console.log(message);
  return message;
}

/** Installable trigger handler for the linked form. */
function onFormSubmit(e: GoogleAppsScript.Events.FormsOnFormSubmit): void {
  const response = toResponseData(e.source, e.response);
  const outcome = processResponse(response, createGasDeps());
  // Only the response ID is logged: answers and addresses are personal data.
  console.log(`${outcome.ok ? "Processed" : "Failed to process"} response ${response.responseId}`);
}

/**
 * Creates the form-submit trigger for the form linked to this spreadsheet. Replaces an
 * existing one, so running it twice does not send documents twice.
 */
function setupFormTrigger(): string {
  const formUrl = SpreadsheetApp.getActiveSpreadsheet().getFormUrl();
  if (formUrl === null) {
    throw new Error(
      "このスプレッドシートにリンクされたフォームがありません。フォームの「回答」タブで「スプレッドシートにリンク」から、このスプレッドシートを選んでください",
    );
  }
  for (const trigger of ScriptApp.getProjectTriggers()) {
    if (trigger.getHandlerFunction() === FORM_SUBMIT_HANDLER) ScriptApp.deleteTrigger(trigger);
  }
  ScriptApp.newTrigger(FORM_SUBMIT_HANDLER)
    .forForm(FormApp.openByUrl(formUrl))
    .onFormSubmit()
    .create();
  const message = "フォーム送信時の自動処理を設定しました";
  console.log(message);
  return message;
}

function createGasDeps(): ProcessDeps {
  return {
    loadSettings: () => loadSettings(createGasSheetReader()),
    documents: createGasDocumentService(),
    mailer: createGasMailer(),
    log: createGasLogWriter(),
    state: createGasStateStore(),
    now: () => toLocalDateTime(new Date()),
  };
}

export const gasEntries = { healthCheck, onFormSubmit, setupFormTrigger };

Object.assign(globalThis, gasEntries);
