import { describe, expect, it } from "vitest";
import type { LocalDateTime } from "../../src/core/datetime";
import {
  documentText,
  findSample,
  SAMPLES,
  type SampleQuestion,
  type SampleTemplate,
} from "../../src/core/samples";
import { parseSettings, settingsSheetTemplate } from "../../src/core/settings";
import { buildFields, type FieldValue, renderTemplate } from "../../src/core/template";

const now: LocalDateTime = {
  year: 2026,
  month: 10,
  day: 3,
  hour: 14,
  minute: 5,
  second: 0,
  hasTime: true,
};

function sampleAnswer(question: SampleQuestion): FieldValue {
  switch (question.type) {
    case "email":
      return "taro@example.com";
    case "number":
      return "110000";
    case "date":
      return "2026-10-15";
    case "choice":
      return question.choices?.[0] ?? "";
    default:
      return `${question.title}の回答`;
  }
}

const fieldsFor = (sample: SampleTemplate, answer = sampleAnswer) =>
  buildFields({
    answers: new Map(sample.questions.map((q) => [q.title, answer(q)])),
    today: now,
    submittedAt: now,
  });

const templatesOf = (sample: SampleTemplate) => ({
  document: documentText(sample.document),
  fileName: sample.settings.fileNameTemplate,
  subject: sample.settings.subjectTemplate,
  body: sample.settings.bodyTemplate,
});

describe.each(SAMPLES.map((s) => [s.label, s] as const))("%s sample", (_label, sample) => {
  it("resolves every placeholder from its own questions", () => {
    for (const template of Object.values(templatesOf(sample))) {
      const result = renderTemplate(template, fieldsFor(sample));
      expect(result).toMatchObject({ ok: true });
      expect(result.ok && result.value).not.toContain("{{");
    }
  });

  it("still renders when optional questions are left blank", () => {
    const fields = fieldsFor(sample, (q) => (q.required ? sampleAnswer(q) : ""));
    for (const template of Object.values(templatesOf(sample))) {
      expect(renderTemplate(template, fields).ok).toBe(true);
    }
  });

  it("produces valid settings with the created IDs", () => {
    const rows = settingsSheetTemplate({
      templateDocId: "https://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/edit",
      outputFolderId: "https://drive.google.com/drive/folders/1XyZ_abc-DEF0123456789",
      ...sample.settings,
    });
    expect(parseSettings(rows)).toMatchObject({ ok: true });
  });

  it("sends to a required email question", () => {
    const question = sample.questions.find((q) => q.title === sample.settings.emailFieldName);
    expect(question).toMatchObject({ type: "email", required: true });
  });

  it("has unique question titles and choices for every choice question", () => {
    const titles = sample.questions.map((q) => q.title);
    expect(new Set(titles).size).toBe(titles.length);
    for (const q of sample.questions.filter((q) => q.type === "choice")) {
      expect(q.choices?.length).toBeGreaterThan(0);
    }
  });
});

describe("estimate sample", () => {
  it("formats amounts and dates", () => {
    const result = renderTemplate(
      documentText(findSample("estimate").document),
      fieldsFor(findSample("estimate")),
    );
    expect(result.ok && result.value).toContain("¥110,000");
    expect(result.ok && result.value).toContain("2026年10月15日");
  });
});
