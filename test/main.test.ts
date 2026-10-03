import { describe, expect, it } from "vitest";
import { gasEntries } from "../src/main";

describe("main", () => {
  it("exposes every GAS entry point on globalThis", () => {
    const g = globalThis as Record<string, unknown>;
    expect(Object.keys(gasEntries)).toEqual([
      "onOpen",
      "menuSetup",
      "menuTestSend",
      "menuRetryFailed",
      "menuSampleEstimate",
      "menuSampleApplication",
      "menuSampleCertificate",
      "onFormSubmit",
      "healthCheck",
      "setupFormTrigger",
    ]);
    for (const [name, fn] of Object.entries(gasEntries)) {
      expect(g[name]).toBe(fn);
    }
  });

  it("healthCheck reports readiness", () => {
    expect(gasEntries.healthCheck()).toBe("gws-automation is ready");
  });
});
