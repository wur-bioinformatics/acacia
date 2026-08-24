import { describe, it, expect } from "vitest";
import { formatCursorPosition } from "./cursorPosition";

describe("formatCursorPosition", () => {
  it("shows 1-based row and column numbers", () => {
    expect(
      formatCursorPosition({ row: 0, col: 0, clientX: 0, clientY: 0 }),
    ).toEqual({
      row: "row 1",
      col: "col 1",
    });
  });

  it("names the consensus row instead of numbering it", () => {
    expect(
      formatCursorPosition({ row: null, col: 41, clientX: 0, clientY: 0 }),
    ).toEqual({
      row: "consensus",
      col: "col 42",
    });
  });
});
