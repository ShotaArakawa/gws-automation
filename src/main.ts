/**
 * Entry point bundled into dist/Code.js.
 *
 * Apps Script calls functions by name (triggers, menu items, editor runs), so every such
 * function must be exposed on globalThis. scripts/build.mjs detects them and adds top-level
 * declarations so they also appear in the Apps Script editor.
 */
import { createGasDocumentService } from "./adapters/document";
import { createGasFormService, toLocalDateTime, toResponseData } from "./adapters/form";
import { createGasLogSheet } from "./adapters/log-sheet";
import { createGasMailer } from "./adapters/mail";
import { createGasStateStore } from "./adapters/properties";
import { createGasSheets } from "./adapters/spreadsheet";
import { createGasUi } from "./adapters/ui";
import {
  type ActionDeps,
  FORM_SUBMIT_HANDLER,
  runRetryFailed,
  runSetup,
  runTestSend,
} from "./core/actions";
import { type ProcessDeps, processResponse } from "./core/process";
import { loadSettings } from "./core/settings";

export const MENU_TITLE = "書類の自動送信";

/** Simple trigger: adds the custom menu when the spreadsheet is opened. */
function onOpen(): void {
  SpreadsheetApp.getUi()
    .createMenu(MENU_TITLE)
    .addItem("初期設定", "menuSetup")
    .addItem("テスト送信", "menuTestSend")
    .addItem("失敗分を再送", "menuRetryFailed")
    .addToUi();
}

function menuSetup(): void {
  runSetup(createActionDeps());
}

function menuTestSend(): void {
  runTestSend(createActionDeps());
}

function menuRetryFailed(): void {
  runRetryFailed(createActionDeps());
}

/** Installable trigger handler for the linked form. */
function onFormSubmit(e: GoogleAppsScript.Events.FormsOnFormSubmit): void {
  const response = toResponseData(e.source, e.response);
  const outcome = processResponse(response, createProcessDeps());
  // Only the response ID is logged: answers and addresses are personal data.
  console.log(`${outcome.ok ? "Processed" : "Failed to process"} response ${response.responseId}`);
}

/** Run from the Apps Script editor to confirm that `pnpm push` updated the script. */
function healthCheck(): string {
  const message = "gws-automation is ready";
  console.log(message);
  return message;
}

/** Same as the 「初期設定」 trigger step, for running from the Apps Script editor. */
function setupFormTrigger(): string {
  createGasFormService().installSubmitTrigger(FORM_SUBMIT_HANDLER);
  const message = "フォーム送信時の自動処理を設定しました";
  console.log(message);
  return message;
}

function createProcessDeps(): ProcessDeps {
  const sheets = createGasSheets();
  return {
    loadSettings: () => loadSettings(sheets),
    documents: createGasDocumentService(),
    mailer: createGasMailer(),
    log: createGasLogSheet(),
    state: createGasStateStore(),
    now: () => toLocalDateTime(new Date()),
  };
}

function createActionDeps(): ActionDeps {
  return {
    ...createProcessDeps(),
    log: createGasLogSheet(),
    sheets: createGasSheets(),
    forms: createGasFormService(),
    ui: createGasUi(),
  };
}

export const gasEntries = {
  onOpen,
  menuSetup,
  menuTestSend,
  menuRetryFailed,
  onFormSubmit,
  healthCheck,
  setupFormTrigger,
};

Object.assign(globalThis, gasEntries);
