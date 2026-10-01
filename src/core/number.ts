const FULL_WIDTH = /[０-９，．－]/g;
const IGNORED = /[,\s¥￥円]/g;
const NUMBER_PATTERN = /^-?\d+(\.\d+)?$/;

/**
 * Reads a number typed into a form ("12000", "12,000", "￥１２，０００", "12000円").
 * Returns undefined when the text is not a number.
 */
export function parseNumber(text: string): number | undefined {
  const normalized = text
    .replace(FULL_WIDTH, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(IGNORED, "");
  return NUMBER_PATTERN.test(normalized) ? Number(normalized) : undefined;
}

/** 12000 → "12,000", 1234.5 → "1,234.5" */
export function formatNumber(value: number): string {
  const [int = "", frac] = String(Math.abs(value)).split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${value < 0 ? "-" : ""}${grouped}${frac === undefined ? "" : `.${frac}`}`;
}

/** 12000 → "¥12,000". Callers must pass an integer. */
export function formatYen(value: number): string {
  const formatted = formatNumber(value);
  return formatted.startsWith("-") ? `-¥${formatted.slice(1)}` : `¥${formatted}`;
}
