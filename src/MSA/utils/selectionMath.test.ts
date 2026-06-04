import { describe, it, expect } from "vitest";
import {
  applySelectionMode,
  intRangeSet,
  pixelRectToColRange,
  pixelRectToRowRange,
  pixelToCol,
  pixelToRow,
} from "./selectionMath";

describe("pixelToCol / pixelToRow", () => {
  it("maps pixel to column with offset and scale", () => {
    // cellSize 16, scale 1, offsetX 0 → x=20 falls in column 1
    expect(pixelToCol(20, 0, 1, 16)).toBe(1);
    // with offsetX -32 → x=20 maps to (20 - -32)/16 = 3.25 → col 3
    expect(pixelToCol(20, -32, 1, 16)).toBe(3);
    // with scale 2 → cells are 32 wide
    expect(pixelToCol(40, 0, 2, 16)).toBe(1);
  });

  it("subtracts the consensus row when showConsensus is true", () => {
    // y=20, offsetY=0, cellSize=16 → visualRow=1; with consensus → dataRow=0
    expect(pixelToRow(20, 0, 16, true)).toBe(0);
    expect(pixelToRow(20, 0, 16, false)).toBe(1);
  });
});

describe("pixelRectToColRange", () => {
  it("returns the inclusive col range covered by the pixel rect", () => {
    const r = pixelRectToColRange(8, 40, 0, 1, 16, 10);
    expect(r).toEqual({ colMin: 0, colMax: 2 });
  });

  it("normalises start > end", () => {
    const a = pixelRectToColRange(40, 8, 0, 1, 16, 10);
    const b = pixelRectToColRange(8, 40, 0, 1, 16, 10);
    expect(a).toEqual(b);
  });

  it("clamps to the column bounds", () => {
    const r = pixelRectToColRange(-50, 9999, 0, 1, 16, 5);
    expect(r).toEqual({ colMin: 0, colMax: 4 });
  });

  it("returns null when nCols is zero", () => {
    expect(pixelRectToColRange(0, 100, 0, 1, 16, 0)).toBeNull();
  });
});

describe("pixelRectToRowRange", () => {
  it("converts pixel rect to data-row range when showConsensus is true", () => {
    // Rows: consensus at visualRow 0, data rows shift by -1
    // y=20..70 (cellSize 16, offsetY 0) → visualRow 1..4 → dataRow 0..3
    const r = pixelRectToRowRange(20, 70, 0, 16, 5, true);
    expect(r).toEqual({ rowMin: 0, rowMax: 3 });
  });

  it("clamps negative data rows to 0", () => {
    // y=0..10 with consensus → visualRow 0..0 → dataRow -1..-1 → clamped to 0..0
    const r = pixelRectToRowRange(0, 10, 0, 16, 5, true);
    expect(r).toEqual({ rowMin: 0, rowMax: 0 });
  });
});

describe("applySelectionMode", () => {
  it("replace clears prev and uses range", () => {
    const next = applySelectionMode(new Set([1, 2]), [3, 4], "replace");
    expect(next).toEqual(new Set([3, 4]));
  });

  it("additive adds range to prev", () => {
    const next = applySelectionMode(new Set([1, 2]), [2, 3], "additive");
    expect(next).toEqual(new Set([1, 2, 3]));
  });

  it("toggle XORs range against prev", () => {
    const next = applySelectionMode(new Set([1, 2, 3]), [2, 4], "toggle");
    expect(next).toEqual(new Set([1, 3, 4]));
  });

  it("does not mutate prev", () => {
    const prev = new Set([1, 2]);
    applySelectionMode(prev, [3], "additive");
    expect(prev).toEqual(new Set([1, 2]));
  });
});

describe("intRangeSet", () => {
  it("builds inclusive integer ranges", () => {
    expect(intRangeSet(2, 5)).toEqual(new Set([2, 3, 4, 5]));
    expect(intRangeSet(3, 3)).toEqual(new Set([3]));
  });
});
