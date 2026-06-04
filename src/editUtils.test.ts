import { describe, expect, it } from "vitest";
import { currentDimensions, canApplyRemoval } from "./editUtils";
import type { MSAData } from "./MSA/types";
import type { Edit } from "./editStore";

const msa = (rows: Record<string, string>): MSAData =>
  Object.entries(rows).map(([identifier, sequence]) => ({ identifier, sequence }));

describe("currentDimensions", () => {
  it("returns zero for an empty alignment", () => {
    expect(currentDimensions([], [])).toEqual({ rows: 0, cols: 0 });
  });

  it("reports original dimensions with no edits", () => {
    const m = msa({ a: "ACGT", b: "ACGT", c: "ACGT" });
    expect(currentDimensions(m, [])).toEqual({ rows: 3, cols: 4 });
  });

  it("subtracts distinct removed rows and columns", () => {
    const m = msa({ a: "ACGT", b: "ACGT", c: "ACGT" });
    const edits: Edit[] = [
      { type: "remove_row", originalId: "b" },
      { type: "remove_column", originalIndex: 0 },
      { type: "remove_column", originalIndex: 2 },
    ];
    expect(currentDimensions(m, edits)).toEqual({ rows: 2, cols: 2 });
  });

  it("ignores renames", () => {
    const m = msa({ a: "ACGT", b: "ACGT" });
    const edits: Edit[] = [{ type: "rename", originalId: "a", newName: "x" }];
    expect(currentDimensions(m, edits)).toEqual({ rows: 2, cols: 4 });
  });
});

describe("canApplyRemoval", () => {
  const m = msa({ a: "ACGT", b: "ACGT", c: "ACGT" });

  it("allows non-removal edits unconditionally", () => {
    const edit: Edit = { type: "rename", originalId: "a", newName: "x" };
    expect(canApplyRemoval(msa({ a: "A" }), [], edit)).toBe(true);
  });

  it("allows removing a row while others remain", () => {
    expect(canApplyRemoval(m, [], { type: "remove_row", originalId: "a" })).toBe(true);
  });

  it("blocks removing the final remaining row", () => {
    const edits: Edit[] = [
      { type: "remove_row", originalId: "a" },
      { type: "remove_row", originalId: "b" },
    ];
    expect(canApplyRemoval(m, edits, { type: "remove_row", originalId: "c" })).toBe(false);
  });

  it("blocks removing the final remaining column", () => {
    const edits: Edit[] = [
      { type: "remove_column", originalIndex: 0 },
      { type: "remove_column", originalIndex: 1 },
      { type: "remove_column", originalIndex: 2 },
    ];
    expect(canApplyRemoval(m, edits, { type: "remove_column", originalIndex: 3 })).toBe(false);
  });

  it("allows a duplicate removal even at the last row (it is a no-op)", () => {
    // a and b already gone; re-removing b does not change the row count.
    const edits: Edit[] = [
      { type: "remove_row", originalId: "a" },
      { type: "remove_row", originalId: "b" },
    ];
    expect(canApplyRemoval(m, edits, { type: "remove_row", originalId: "b" })).toBe(true);
  });

  it("treats a single-row alignment as already at the floor", () => {
    expect(canApplyRemoval(msa({ a: "ACGT" }), [], { type: "remove_row", originalId: "a" })).toBe(
      false,
    );
  });
});
