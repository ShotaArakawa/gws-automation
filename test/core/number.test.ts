import { describe, expect, it } from "vitest";
import { formatNumber, formatYen, parseNumber } from "../../src/core/number";

describe("parseNumber", () => {
  it.each([
    ["12000", 12000],
    ["12,000", 12000],
    ["￥１２，０００", 12000],
    ["12000円", 12000],
    [" -1500 ", -1500],
    ["1234.5", 1234.5],
  ])("%s → %d", (input, expected) => {
    expect(parseNumber(input)).toBe(expected);
  });

  it.each(["", "abc", "1.2.3", "12-3"])("rejects %j", (input) => {
    expect(parseNumber(input)).toBeUndefined();
  });
});

describe("formatNumber / formatYen", () => {
  it("groups thousands", () => {
    expect(formatNumber(0)).toBe("0");
    expect(formatNumber(1234567.25)).toBe("1,234,567.25");
    expect(formatNumber(-1000)).toBe("-1,000");
  });

  it("adds the yen sign", () => {
    expect(formatYen(12000)).toBe("¥12,000");
    expect(formatYen(-500)).toBe("-¥500");
  });
});
