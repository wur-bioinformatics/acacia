import { describe, it, expect } from "vitest";
import { parseFasta, readTextFile } from "./fasta";

describe("parseFasta", () => {
  it("parses a simple two-record FASTA", () => {
    const input = ">seq1\nACGT\n>seq2\nA--T\n";
    expect(parseFasta(input)).toEqual([
      { identifier: "seq1", sequence: "ACGT" },
      { identifier: "seq2", sequence: "A--T" },
    ]);
  });

  it("handles CRLF line endings", () => {
    const input = ">seq1\r\nACGT\r\n>seq2\r\nTGCA\r\n";
    expect(parseFasta(input)).toEqual([
      { identifier: "seq1", sequence: "ACGT" },
      { identifier: "seq2", sequence: "TGCA" },
    ]);
  });

  it("concatenates multi-line sequences", () => {
    const input = ">seq1\nACGT\nACGT\n";
    expect(parseFasta(input)).toEqual([
      { identifier: "seq1", sequence: "ACGTACGT" },
    ]);
  });

  it("trims whitespace from header and sequence lines", () => {
    const input = "> seq1 \n ACGT \n";
    expect(parseFasta(input)).toEqual([
      { identifier: "seq1", sequence: "ACGT" },
    ]);
  });

  it("ignores blank lines between records", () => {
    const input = ">seq1\nACGT\n\n>seq2\nTGCA\n";
    expect(parseFasta(input)).toEqual([
      { identifier: "seq1", sequence: "ACGT" },
      { identifier: "seq2", sequence: "TGCA" },
    ]);
  });

  it("ignores lines before the first header", () => {
    const input = "some preamble\n>seq1\nACGT\n";
    expect(parseFasta(input)).toEqual([
      { identifier: "seq1", sequence: "ACGT" },
    ]);
  });

  it("returns empty array for empty input", () => {
    expect(parseFasta("")).toEqual([]);
  });

  it("returns empty array when no header lines are present", () => {
    expect(parseFasta("ACGT\nTGCA\n")).toEqual([]);
  });
});

describe("readTextFile", () => {
  it("resolves with the file text content", async () => {
    const file = new File([">seq1\nACGT\n"], "test.fasta", {
      type: "text/plain",
    });
    await expect(readTextFile(file)).resolves.toBe(">seq1\nACGT\n");
  });

  it("handles an empty file", async () => {
    const file = new File([""], "empty.fasta", { type: "text/plain" });
    await expect(readTextFile(file)).resolves.toBe("");
  });
});
