import { describe, expect, it } from "vitest";
import {
  formatDateTime,
  formatDefault,
  type LocalDateTime,
  parseDateString,
} from "../../src/core/datetime";

const dt = (overrides: Partial<LocalDateTime> = {}): LocalDateTime => ({
  year: 2026,
  month: 10,
  day: 2,
  hour: 9,
  minute: 5,
  second: 7,
  hasTime: true,
  ...overrides,
});

describe("parseDateString", () => {
  it("parses Google Forms date and datetime answers", () => {
    expect(parseDateString("2026-10-02")).toEqual(
      dt({ hour: 0, minute: 0, second: 0, hasTime: false }),
    );
    expect(parseDateString("2026-10-02 14:30")).toEqual(dt({ hour: 14, minute: 30, second: 0 }));
    expect(parseDateString("2026/1/5")).toMatchObject({ month: 1, day: 5 });
  });

  it("rejects non-dates and impossible dates", () => {
    expect(parseDateString("来週")).toBeUndefined();
    expect(parseDateString("2026-02-30")).toBeUndefined();
    expect(parseDateString("2026-10-02 25:00")).toBeUndefined();
  });
});

describe("formatDateTime", () => {
  it("supports every token", () => {
    expect(formatDateTime(dt(), "yyyy/MM/dd HH:mm:ss")).toBe("2026/10/02 09:05:07");
    expect(formatDateTime(dt(), "yy年M月d日(E) H時")).toBe("26年10月2日(金) 9時");
  });

  it("uses Japanese defaults with or without time", () => {
    expect(formatDefault(dt({ hasTime: false }))).toBe("2026年10月2日");
    expect(formatDefault(dt())).toBe("2026年10月2日 9:05");
  });
});
