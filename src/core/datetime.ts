/**
 * Calendar date/time without a time zone. Adapters convert from Date in the script's time
 * zone, so core logic and tests never depend on the machine's time zone.
 */
export interface LocalDateTime {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
  hasTime: boolean;
}

const DATE_PATTERN = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;

/**
 * Parses a date answer as Google Forms returns it ("2026-10-02" or "2026-10-02 14:30").
 * Slash separators are accepted as well. Returns undefined for anything else.
 */
export function parseDateString(text: string): LocalDateTime | undefined {
  const m = DATE_PATTERN.exec(text.trim());
  if (!m) return undefined;
  const [, y, mo, d, h, mi, s] = m;
  const dt: LocalDateTime = {
    year: Number(y),
    month: Number(mo),
    day: Number(d),
    hour: Number(h ?? 0),
    minute: Number(mi ?? 0),
    second: Number(s ?? 0),
    hasTime: h !== undefined,
  };
  return isValid(dt) ? dt : undefined;
}

function isValid(dt: LocalDateTime): boolean {
  const date = new Date(Date.UTC(dt.year, dt.month - 1, dt.day));
  return (
    date.getUTCFullYear() === dt.year &&
    date.getUTCMonth() === dt.month - 1 &&
    date.getUTCDate() === dt.day &&
    dt.hour < 24 &&
    dt.minute < 60 &&
    dt.second < 60
  );
}

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];
const TOKEN = /yyyy|yy|MM|M|dd|d|HH|H|mm|ss|E/g;

/**
 * Formats with a small pattern language: yyyy yy MM M dd d HH H mm ss, and E for the
 * Japanese weekday (月, 火, ...). Any other character is copied as is.
 */
export function formatDateTime(dt: LocalDateTime, pattern: string): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return pattern.replace(TOKEN, (token) => {
    switch (token) {
      case "yyyy":
        return String(dt.year);
      case "yy":
        return pad(dt.year % 100);
      case "MM":
        return pad(dt.month);
      case "M":
        return String(dt.month);
      case "dd":
        return pad(dt.day);
      case "d":
        return String(dt.day);
      case "HH":
        return pad(dt.hour);
      case "H":
        return String(dt.hour);
      case "mm":
        return pad(dt.minute);
      case "ss":
        return pad(dt.second);
      default:
        return WEEKDAYS[new Date(Date.UTC(dt.year, dt.month - 1, dt.day)).getUTCDay()] ?? "";
    }
  });
}

export const DEFAULT_DATE_PATTERN = "yyyy年M月d日";
export const DEFAULT_DATETIME_PATTERN = "yyyy年M月d日 H:mm";

export function formatDefault(dt: LocalDateTime): string {
  return formatDateTime(dt, dt.hasTime ? DEFAULT_DATETIME_PATTERN : DEFAULT_DATE_PATTERN);
}
