import { describe, it, expect } from "vitest";
import { rowMeanTCS } from "./rowQuality";
import type { MSAData } from "../types";

const msa = (rows: Record<string, string>): MSAData =>
  Object.entries(rows).map(([identifier, sequence]) => ({ identifier, sequence }));

describe("rowMeanTCS", () => {
  it("averages over non-gap positions only", () => {
    const tcs = [[1.0, 0.5, 0.0]];
    const m = msa({ a: "A-C" });
    const result = rowMeanTCS(tcs, m, ["a"]);
    // Non-gap positions are 0 and 2 → (1.0 + 0.0) / 2 = 0.5
    expect(result.get("a")).toBeCloseTo(0.5);
  });

  it("uses tcsIdentifiers to map rows to identifiers, regardless of msa order", () => {
    // tcs row 0 was computed for "b", row 1 for "a"
    const tcs = [
      [1.0, 1.0], // b
      [0.0, 0.0], // a
    ];
    const m = msa({ a: "AA", b: "AA" });
    const result = rowMeanTCS(tcs, m, ["b", "a"]);
    expect(result.get("a")).toBeCloseTo(0);
    expect(result.get("b")).toBeCloseTo(1);
  });

  it("skips identifiers not present in the current MSA", () => {
    const tcs = [[0.5], [0.5]];
    const m = msa({ a: "A" });
    const result = rowMeanTCS(tcs, m, ["a", "deleted"]);
    expect(result.has("deleted")).toBe(false);
    expect(result.get("a")).toBeCloseTo(0.5);
  });

  it("omits rows with no non-gap positions", () => {
    const tcs = [[0, 0]];
    const m = msa({ a: "--" });
    const result = rowMeanTCS(tcs, m, ["a"]);
    expect(result.has("a")).toBe(false);
  });

  it("handles per-row score arrays shorter than the sequence", () => {
    const tcs = [[1.0]];
    const m = msa({ a: "AA" });
    const result = rowMeanTCS(tcs, m, ["a"]);
    // Only position 0 contributes (scores has length 1)
    expect(result.get("a")).toBeCloseTo(1);
  });
});
