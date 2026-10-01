/**
 * Placeholder substitution: {{質問のタイトル}} or {{質問のタイトル:書式}}.
 *
 * Supported formats: yen (¥12,000), number (12,000), date(pattern) (see formatDateTime).
 * A placeholder naming a question that does not exist is an error (usually a typo in the
 * template); a question that exists but was left unanswered becomes an empty string.
 */
import { formatDateTime, formatDefault, type LocalDateTime, parseDateString } from "./datetime";
import { formatNumber, formatYen, parseNumber } from "./number";
import { fail, ok, type Result } from "./result";

/** A form answer: text, the choices of a checkbox question, or a date/time value. */
export type FieldValue = string | readonly string[] | LocalDateTime;

export type FieldMap = ReadonlyMap<string, FieldValue>;

export const BUILTIN_TODAY = "今日";
export const BUILTIN_SUBMITTED_AT = "送信日時";

/**
 * Adds the built-in fields to the answers. A question with the same title as a built-in
 * field takes precedence.
 */
export function buildFields(params: {
  answers: FieldMap;
  today: LocalDateTime;
  submittedAt: LocalDateTime;
}): FieldMap {
  return new Map<string, FieldValue>([
    [BUILTIN_TODAY, { ...params.today, hasTime: false }],
    [BUILTIN_SUBMITTED_AT, { ...params.submittedAt, hasTime: true }],
    ...params.answers,
  ]);
}

type Format = { kind: "yen" } | { kind: "number" } | { kind: "date"; pattern: string };

const PLACEHOLDER = /\{\{([^{}]*)\}\}/g;
const KNOWN_FORMAT = /^(.*?):\s*(yen|number|date\((.*)\))\s*$/s;
const FORMAT_LIKE = /^(.*?):\s*([A-Za-z]+(?:\(.*\))?)\s*$/s;
const FORMAT_HELP = "使える書式は yen・number・date(yyyy/MM/dd) です";

/** Returns every placeholder in the text, e.g. ["{{お名前}}", "{{合計金額:yen}}"], without duplicates. */
export function findPlaceholders(text: string): string[] {
  return [...new Set(text.match(PLACEHOLDER) ?? [])];
}

/** Checks the template's syntax only; it does not need to know the form's questions. */
export function checkTemplateSyntax(text: string): string[] {
  const errors: string[] = [];
  for (const placeholder of findPlaceholders(text)) {
    const inner = placeholder.slice(2, -2).trim();
    if (inner === "") {
      errors.push("{{}} の中に質問のタイトルがありません");
    } else if (/:\s*date\(\s*\)\s*$/.test(inner)) {
      errors.push(`${placeholder} の date() に日付の形式（例：yyyy/MM/dd）を書いてください`);
    }
  }
  const rest = text.replace(PLACEHOLDER, "");
  if (rest.includes("{{") || rest.includes("}}")) {
    errors.push("{{ と }} の対応が取れていない箇所があります");
  }
  return errors;
}

/** Resolves one placeholder such as "{{合計金額:yen}}" to its text. */
export function resolvePlaceholder(placeholder: string, fields: FieldMap): Result<string> {
  const inner = placeholder.slice(2, -2).trim();

  const exact = fields.get(inner);
  if (exact !== undefined) return ok(toText(exact));

  const known = KNOWN_FORMAT.exec(inner);
  const name = known?.[1]?.trim();
  if (known && name !== undefined) {
    const value = fields.get(name);
    if (value !== undefined) return applyFormat(placeholder, value, parseFormat(known));
  }

  const formatLike = FORMAT_LIKE.exec(inner);
  const formatLikeName = formatLike?.[1]?.trim();
  if (formatLikeName !== undefined && fields.has(formatLikeName)) {
    return fail(`${placeholder} の書式「${formatLike?.[2]}」は使えません。${FORMAT_HELP}`);
  }

  return fail(`${placeholder}：フォームに「${name ?? inner}」という質問が見つかりません`);
}

/** Replaces every placeholder in the text. Reports all problems at once. */
export function renderTemplate(text: string, fields: FieldMap): Result<string> {
  const syntaxErrors = checkTemplateSyntax(text);
  if (syntaxErrors.length > 0) return fail(...syntaxErrors);

  const resolved = new Map<string, string>();
  const errors: string[] = [];
  for (const placeholder of findPlaceholders(text)) {
    const result = resolvePlaceholder(placeholder, fields);
    if (result.ok) resolved.set(placeholder, result.value);
    else errors.push(...result.errors);
  }
  if (errors.length > 0) return fail(...errors);
  return ok(text.replace(PLACEHOLDER, (placeholder) => resolved.get(placeholder) ?? ""));
}

function parseFormat(match: RegExpExecArray): Format {
  if (match[2] === "yen") return { kind: "yen" };
  if (match[2] === "number") return { kind: "number" };
  return { kind: "date", pattern: match[3] ?? "" };
}

function toText(value: FieldValue): string {
  if (typeof value === "string") return value;
  if (isDateTime(value)) return formatDefault(value);
  return value.join("、");
}

function isDateTime(value: FieldValue): value is LocalDateTime {
  return typeof value === "object" && !Array.isArray(value);
}

function applyFormat(placeholder: string, value: FieldValue, format: Format): Result<string> {
  if (value === "" || (Array.isArray(value) && value.length === 0)) return ok("");

  if (format.kind === "date") {
    const dt = isDateTime(value)
      ? value
      : typeof value === "string"
        ? parseDateString(value)
        : undefined;
    if (dt === undefined)
      return fail(`${placeholder}：回答が日付ではないため date の書式を使えません`);
    return ok(formatDateTime(dt, format.pattern));
  }

  const n = typeof value === "string" ? parseNumber(value) : undefined;
  if (n === undefined)
    return fail(`${placeholder}：回答が数値ではないため ${format.kind} の書式を使えません`);
  if (format.kind === "number") return ok(formatNumber(n));
  if (!Number.isInteger(n)) return fail(`${placeholder}：金額に小数が含まれています`);
  return ok(formatYen(n));
}
