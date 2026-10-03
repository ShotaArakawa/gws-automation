import { describe, expect, it } from "vitest";
import { selectRetryTargets } from "../../src/core/retry";

describe("selectRetryTargets", () => {
  it("returns responses whose latest row failed, oldest first", () => {
    expect(
      selectRetryTargets([
        { row: 2, responseId: "a", status: "成功" },
        { row: 3, responseId: "b", status: "失敗" },
        { row: 4, responseId: "c", status: "失敗" },
      ]),
    ).toEqual([
      { responseId: "b", rows: [3] },
      { responseId: "c", rows: [4] },
    ]);
  });

  it("resends a response once and marks all of its failed rows", () => {
    expect(
      selectRetryTargets([
        { row: 2, responseId: "a", status: "失敗" },
        { row: 3, responseId: "a", status: "失敗" },
      ]),
    ).toEqual([{ responseId: "a", rows: [2, 3] }]);
  });

  it("skips responses that later succeeded or were already retried", () => {
    expect(
      selectRetryTargets([
        { row: 2, responseId: "a", status: "再送済み" },
        { row: 3, responseId: "a", status: "成功" },
        { row: 4, responseId: "b", status: "失敗" },
        { row: 5, responseId: "b", status: "成功" },
        { row: 6, responseId: "c", status: "再送済み" },
      ]),
    ).toEqual([]);
  });

  it("ignores rows without a response ID", () => {
    expect(selectRetryTargets([{ row: 2, responseId: "", status: "失敗" }])).toEqual([]);
  });
});
