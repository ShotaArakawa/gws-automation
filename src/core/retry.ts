import type { LogRow } from "../adapters/log-sheet";

export interface RetryTarget {
  responseId: string;
  /** Failed rows of this response, to be marked 「再送済み」 after the retry. */
  rows: number[];
}

/**
 * Picks the responses to resend: those whose most recent log row is 「失敗」.
 * A response that later succeeded (or is already being retried) is skipped, and each
 * response is resent once even if it failed several times.
 */
export function selectRetryTargets(rows: readonly LogRow[]): RetryTarget[] {
  const latest = new Map<string, LogRow>();
  const failedRows = new Map<string, number[]>();
  for (const row of rows) {
    if (row.responseId === "") continue;
    latest.set(row.responseId, row);
    if (row.status === "失敗") {
      failedRows.set(row.responseId, [...(failedRows.get(row.responseId) ?? []), row.row]);
    }
  }
  return [...latest.values()]
    .filter((row) => row.status === "失敗")
    .sort((a, b) => a.row - b.row)
    .map((row) => ({ responseId: row.responseId, rows: failedRows.get(row.responseId) ?? [] }));
}
