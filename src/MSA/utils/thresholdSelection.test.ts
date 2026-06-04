import { describe, expect, it } from "vitest";
import { computeThresholdSelection, type ThresholdCriteria } from "./thresholdSelection";

const base: ThresholdCriteria = {
  conservation: [],
  conservationThreshold: 0,
  trident: null,
  tridentThreshold: 0,
  tcsColMean: null,
  tcsColThreshold: 0,
  colGaps: [],
  colGapThreshold: 0,
  rowTcsMeans: null,
  rowTcsThreshold: 0,
  rowGaps: new Map(),
  rowGapThreshold: 0,
};

describe("computeThresholdSelection", () => {
  it("selects nothing when every threshold is zero", () => {
    const { columns, rows } = computeThresholdSelection({
      ...base,
      conservation: [0.9, 0.1],
      trident: [0.1, 0.9],
      tcsColMean: [0.1, 0.9],
      colGaps: [0.9, 0.1],
      rowTcsMeans: new Map([["a", 0.1]]),
      rowGaps: new Map([["a", 0.9]]),
    });
    expect(columns.size).toBe(0);
    expect(rows.size).toBe(0);
  });

  it("selects well-conserved columns at/above the threshold", () => {
    const { columns } = computeThresholdSelection({
      ...base,
      conservation: [0.95, 0.5, 0.8],
      conservationThreshold: 0.8,
    });
    expect([...columns].sort()).toEqual([0, 2]);
  });

  it("selects low-TRIDENT columns below the threshold", () => {
    const { columns } = computeThresholdSelection({
      ...base,
      trident: [0.1, 0.6, 0.29],
      tridentThreshold: 0.3,
    });
    expect([...columns].sort()).toEqual([0, 2]);
  });

  it("selects low column-TCS columns below the threshold", () => {
    const { columns } = computeThresholdSelection({
      ...base,
      tcsColMean: [0.2, 0.9, 0.1],
      tcsColThreshold: 0.5,
    });
    expect([...columns].sort()).toEqual([0, 2]);
  });

  it("selects gappy columns above the threshold", () => {
    const { columns } = computeThresholdSelection({
      ...base,
      colGaps: [0.1, 0.6, 0.9],
      colGapThreshold: 0.5,
    });
    expect([...columns].sort()).toEqual([1, 2]);
  });

  it("unions multiple active column criteria", () => {
    const { columns } = computeThresholdSelection({
      ...base,
      trident: [0.1, 0.9, 0.9],
      tridentThreshold: 0.3,
      colGaps: [0.0, 0.0, 0.8],
      colGapThreshold: 0.5,
    });
    // col0 from TRIDENT, col2 from gaps
    expect([...columns].sort()).toEqual([0, 2]);
  });

  it("ignores metrics that have not been computed (null)", () => {
    const { columns, rows } = computeThresholdSelection({
      ...base,
      trident: null,
      tridentThreshold: 0.5,
      tcsColMean: null,
      tcsColThreshold: 0.5,
      rowTcsMeans: null,
      rowTcsThreshold: 0.5,
    });
    expect(columns.size).toBe(0);
    expect(rows.size).toBe(0);
  });

  it("selects low-TCS rows and gappy rows by identifier", () => {
    const { rows } = computeThresholdSelection({
      ...base,
      rowTcsMeans: new Map([
        ["a", 0.2],
        ["b", 0.8],
      ]),
      rowTcsThreshold: 0.5,
      rowGaps: new Map([
        ["b", 0.9],
        ["c", 0.1],
      ]),
      rowGapThreshold: 0.5,
    });
    // a from TCS, b from gaps
    expect([...rows].sort()).toEqual(["a", "b"]);
  });
});
