import { describe, expect, it } from "vitest";
import { columnGapFractions, rowGapFractions } from "./gapFraction";
import type { MSAData } from "../types";

describe("columnGapFractions", () => {
  it("returns an empty array for an empty alignment", () => {
    expect(columnGapFractions([])).toEqual([]);
  });

  it("computes the gap fraction per column", () => {
    const msa: MSAData = [
      { identifier: "a", sequence: "A-CG" },
      { identifier: "b", sequence: "--CG" },
      { identifier: "c", sequence: "A--G" },
      { identifier: "d", sequence: "A-CG" },
    ];
    // col0: 1 gap / 4, col1: 4/4, col2: 1/4, col3: 0/4
    expect(columnGapFractions(msa)).toEqual([0.25, 1, 0.25, 0]);
  });

  it("reports all-gap and no-gap columns at the extremes", () => {
    const msa: MSAData = [
      { identifier: "a", sequence: "A-" },
      { identifier: "b", sequence: "C-" },
    ];
    expect(columnGapFractions(msa)).toEqual([0, 1]);
  });
});

describe("rowGapFractions", () => {
  it("computes the gap fraction per row keyed by identifier", () => {
    const msa: MSAData = [
      { identifier: "a", sequence: "ACGT" },
      { identifier: "b", sequence: "--GT" },
      { identifier: "c", sequence: "----" },
    ];
    const result = rowGapFractions(msa);
    expect(result.get("a")).toBe(0);
    expect(result.get("b")).toBe(0.5);
    expect(result.get("c")).toBe(1);
  });

  it("omits zero-length rows", () => {
    const msa: MSAData = [{ identifier: "a", sequence: "" }];
    expect(rowGapFractions(msa).has("a")).toBe(false);
  });
});
