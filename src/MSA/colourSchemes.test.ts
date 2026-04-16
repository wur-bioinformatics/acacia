import { describe, it, expect } from "vitest";
import { charToColor, detectSequenceType } from "./colourSchemes";

const emptyAnalysis = {
  parsimonyInformativeSites: [],
  conservedSites: [],
  variableSites: [],
};

describe("charToColor", () => {
  it("DNA: returns correct colour for known nucleotides", () => {
    expect(charToColor("A", 0, "DNA", emptyAnalysis)).toBe("#4caf50");
    expect(charToColor("C", 0, "DNA", emptyAnalysis)).toBe("#2196f3");
    expect(charToColor("G", 0, "DNA", emptyAnalysis)).toBe("#ff9800");
    expect(charToColor("T", 0, "DNA", emptyAnalysis)).toBe("#f44336");
  });

  it("DNA: is case-insensitive", () => {
    expect(charToColor("a", 0, "DNA", emptyAnalysis)).toBe(
      charToColor("A", 0, "DNA", emptyAnalysis),
    );
  });

  it("DNA: gap character returns gap colour", () => {
    expect(charToColor("-", 0, "DNA", emptyAnalysis)).toBe("#f4f4f4");
  });

  it("DNA ClustalX: returns correct colour", () => {
    expect(charToColor("A", 0, "DNA ClustalX", emptyAnalysis)).toBe("#64F73F");
  });

  it("AA ClustalX: hydrophobic residues share same colour", () => {
    const color = charToColor("A", 0, "AA ClustalX", emptyAnalysis);
    expect(charToColor("V", 0, "AA ClustalX", emptyAnalysis)).toBe(color);
    expect(charToColor("L", 0, "AA ClustalX", emptyAnalysis)).toBe(color);
  });

  it("Conserved: highlights conserved columns", () => {
    const analysis = { ...emptyAnalysis, conservedSites: [3] };
    expect(charToColor("A", 3, "Conserved", analysis)).toBe("royalblue");
    expect(charToColor("A", 0, "Conserved", analysis)).toBe("#f4f4f4");
  });

  it("Variable: highlights variable columns", () => {
    const analysis = { ...emptyAnalysis, variableSites: [1] };
    expect(charToColor("A", 1, "Variable", analysis)).toBe("royalblue");
    expect(charToColor("A", 0, "Variable", analysis)).toBe("#f4f4f4");
  });

  it("Parsimony Informative: highlights parsimony-informative columns", () => {
    const analysis = { ...emptyAnalysis, parsimonyInformativeSites: [2] };
    expect(charToColor("A", 2, "Parsimony Informative", analysis)).toBe(
      "royalblue",
    );
    expect(charToColor("A", 0, "Parsimony Informative", analysis)).toBe(
      "#f4f4f4",
    );
  });

  it("unknown char returns gap colour for sequence schemes", () => {
    expect(charToColor("X", 0, "DNA", emptyAnalysis)).toBe("#f4f4f4");
  });
});

describe("detectSequenceType", () => {
  it("returns DNA for sequences containing only DNA characters", () => {
    const msa = [
      { identifier: "s1", sequence: "ACGT" },
      { identifier: "s2", sequence: "TTAG" },
    ];
    expect(detectSequenceType(msa)).toBe("DNA");
  });

  it("returns Protein when a protein-only character is present", () => {
    const msa = [{ identifier: "s1", sequence: "ACGF" }]; // F is protein-only
    expect(detectSequenceType(msa)).toBe("Protein");
  });

  it("detects all protein-only trigger characters (E F I L P Q)", () => {
    for (const char of ["E", "F", "I", "L", "P", "Q"]) {
      expect(detectSequenceType([{ identifier: "s", sequence: char }])).toBe(
        "Protein",
      );
    }
  });

  it("is case-insensitive", () => {
    expect(detectSequenceType([{ identifier: "s", sequence: "f" }])).toBe(
      "Protein",
    );
  });

  it("returns DNA for gap-only sequences", () => {
    expect(detectSequenceType([{ identifier: "s", sequence: "---" }])).toBe(
      "DNA",
    );
  });

  it("returns DNA for empty input", () => {
    expect(detectSequenceType([])).toBe("DNA");
  });

  it("returns Protein as soon as one sequence has a protein character", () => {
    const msa = [
      { identifier: "s1", sequence: "ACGT" },
      { identifier: "s2", sequence: "ACGE" }, // E is protein-only
    ];
    expect(detectSequenceType(msa)).toBe("Protein");
  });
});
