import { describe, expect, it } from "vitest";
import type { LocalDateTime } from "../../src/core/datetime";
import {
  buildFields,
  checkTemplateSyntax,
  type FieldValue,
  findPlaceholders,
  renderTemplate,
  resolvePlaceholder,
} from "../../src/core/template";

const today: LocalDateTime = {
  year: 2026,
  month: 10,
  day: 2,
  hour: 15,
  minute: 0,
  second: 0,
  hasTime: true,
};
const submittedAt: LocalDateTime = { ...today, hour: 14, minute: 58 };

const fields = (answers: Record<string, FieldValue>) =>
  buildFields({ answers: new Map(Object.entries(answers)), today, submittedAt });

const sample = fields({
  お名前: "山田 太郎",
  会社名: "山田商店",
  合計金額: "12000",
  希望日: "2026-10-15",
  "受講時間:午前": "9:00",
  オプション: ["印刷", "製本"],
  備考: "",
});

describe("renderTemplate", () => {
  it("replaces answers, formats and built-in fields", () => {
    const result = renderTemplate(
      "{{お名前}} 様（{{会社名}}） 合計 {{合計金額:yen}} / 希望日 {{希望日:date(yyyy/MM/dd)}} / {{今日}} / {{送信日時}}",
      sample,
    );
    expect(result).toEqual({
      ok: true,
      value:
        "山田 太郎 様（山田商店） 合計 ¥12,000 / 希望日 2026/10/15 / 2026年10月2日 / 2026年10月2日 14:58",
    });
  });

  it("joins checkbox answers and leaves unanswered questions blank", () => {
    expect(renderTemplate("[{{オプション}}][{{備考}}][{{備考:yen}}]", sample)).toEqual({
      ok: true,
      value: "[印刷、製本][][]",
    });
  });

  it("allows spaces inside braces and repeated placeholders", () => {
    expect(renderTemplate("{{ お名前 }}/{{お名前}}/{{合計金額 : number}}", sample)).toEqual({
      ok: true,
      value: "山田 太郎/山田 太郎/12,000",
    });
  });

  it("treats a colon that is part of a question title as part of the name", () => {
    expect(renderTemplate("{{受講時間:午前}}", sample)).toEqual({ ok: true, value: "9:00" });
  });

  it("supports colons inside a date pattern", () => {
    const withTime = fields({ 開始: "2026-10-15 13:30" });
    expect(renderTemplate("{{開始:date(M/d HH:mm)}}", withTime)).toEqual({
      ok: true,
      value: "10/15 13:30",
    });
  });

  it("lets a question override a built-in field with the same title", () => {
    expect(renderTemplate("{{今日}}", fields({ 今日: "晴れ" }))).toEqual({
      ok: true,
      value: "晴れ",
    });
  });

  it("formats built-in dates with a pattern", () => {
    expect(renderTemplate("{{今日:date(yyyyMMdd)}}", sample)).toEqual({
      ok: true,
      value: "20261002",
    });
  });

  it("reports every problem at once", () => {
    const result = renderTemplate(
      "{{会社名称}} {{お名前:yen}} {{希望日:円}} {{オプション:number}}",
      sample,
    );
    expect(result).toEqual({
      ok: false,
      errors: [
        "{{会社名称}}：フォームに「会社名称」という質問が見つかりません",
        "{{お名前:yen}}：回答が数値ではないため yen の書式を使えません",
        "{{希望日:円}}：フォームに「希望日:円」という質問が見つかりません",
        "{{オプション:number}}：回答が数値ではないため number の書式を使えません",
      ],
    });
  });

  it("rejects unknown formats and non-date values for date", () => {
    expect(renderTemplate("{{合計金額:currency}}", sample)).toMatchObject({
      ok: false,
      errors: [expect.stringContaining("書式「currency」は使えません")],
    });
    expect(renderTemplate("{{お名前:date(yyyy)}}", sample)).toMatchObject({
      ok: false,
      errors: [expect.stringContaining("日付ではない")],
    });
  });

  it("rejects decimal yen amounts", () => {
    expect(renderTemplate("{{x:yen}}", fields({ x: "10.5" }))).toMatchObject({ ok: false });
  });

  it("returns syntax errors before resolving", () => {
    expect(renderTemplate("{{お名前} 様", sample)).toMatchObject({ ok: false });
  });
});

describe("resolvePlaceholder", () => {
  it("resolves a single placeholder for document replacement", () => {
    expect(resolvePlaceholder("{{合計金額:yen}}", sample)).toEqual({ ok: true, value: "¥12,000" });
  });
});

describe("findPlaceholders", () => {
  it("lists unique placeholders", () => {
    expect(findPlaceholders("{{a}} {{b:yen}} {{a}}")).toEqual(["{{a}}", "{{b:yen}}"]);
  });
});

describe("checkTemplateSyntax", () => {
  it("accepts valid templates", () => {
    expect(checkTemplateSyntax("見積書_{{会社名}}_{{今日:date(yyyyMMdd)}}")).toEqual([]);
    expect(checkTemplateSyntax("プレースホルダーなし")).toEqual([]);
  });

  it("detects broken braces, empty names and empty date patterns", () => {
    expect(checkTemplateSyntax("{{会社名}")).toHaveLength(1);
    expect(checkTemplateSyntax("会社名}}")).toHaveLength(1);
    expect(checkTemplateSyntax("{{ }}")).toEqual(["{{}} の中に質問のタイトルがありません"]);
    expect(checkTemplateSyntax("{{日:date()}}")).toHaveLength(1);
  });
});
