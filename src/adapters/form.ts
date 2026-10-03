import type { LocalDateTime } from "../core/datetime";
import { parseDateString } from "../core/datetime";
import type { FieldValue } from "../core/template";

export interface ResponseData {
  responseId: string;
  /** Every question of the form by title; unanswered questions map to "". */
  answers: ReadonlyMap<string, FieldValue>;
  /** Address collected by the form ("メールアドレスを収集"), or "" when not collected. */
  respondentEmail: string;
  submittedAt: LocalDateTime;
}

// Compared by name so that this module can load without the FormApp global.
const NON_QUESTION_TYPES = new Set(["PAGE_BREAK", "SECTION_HEADER", "IMAGE", "VIDEO"]);

export function toResponseData(
  form: GoogleAppsScript.Forms.Form,
  response: GoogleAppsScript.Forms.FormResponse,
): ResponseData {
  const answers = new Map<string, FieldValue>();
  for (const item of form.getItems()) {
    if (!NON_QUESTION_TYPES.has(String(item.getType()))) answers.set(item.getTitle().trim(), "");
  }
  for (const itemResponse of response.getItemResponses()) {
    answers.set(itemResponse.getItem().getTitle().trim(), toFieldValue(itemResponse.getResponse()));
  }
  return {
    responseId: response.getId(),
    answers,
    respondentEmail: response.getRespondentEmail(),
    submittedAt: toLocalDateTime(response.getTimestamp()),
  };
}

/** Text answers are strings, checkboxes string[], grids string[] or string[][]. */
function toFieldValue(raw: unknown): FieldValue {
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) {
    return raw.map((row: unknown) => (Array.isArray(row) ? row.join("、") : String(row ?? "")));
  }
  return String(raw ?? "");
}

/** Converts a Date to calendar fields in the script's time zone (appsscript.json). */
export function toLocalDateTime(date: GoogleAppsScript.Base.Date): LocalDateTime {
  const text = Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
  const dt = parseDateString(text);
  if (dt === undefined) throw new Error(`Unexpected date format: ${text}`);
  return dt;
}
