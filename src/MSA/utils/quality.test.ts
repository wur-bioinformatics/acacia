import { describe, it, expect } from "vitest";
import {
  BLOSUM62,
  DNA_MATRIX,
  SCORING_PARAMS,
  buildLookup,
  buildPairwiseLibrary,
  computeTcsColumnMeans,
  computeTcsFromLibrary,
  computeTrident,
  matrixRange,
  needlemanWunsch,
  pairIndex,
  stripGapsAndIndex,
} from "./quality";
import type { MSAData, SequenceType } from "../types";

const makeMSA = (sequences: string[]): MSAData =>
  sequences.map((sequence, i) => ({ identifier: `seq${i + 1}`, sequence }));

function runQualityPipeline(msa: MSAData, sequenceType: SequenceType) {
  const { matrix, gapOpen, gapExtend, alphabetSize } = SCORING_PARAMS[sequenceType];
  const lookup = buildLookup(matrix);
  const stripped = msa.map((s) => stripGapsAndIndex(s.sequence));
  const library = buildPairwiseLibrary(
    stripped.map((s) => s.ungapped),
    lookup,
    gapOpen,
    gapExtend,
  );
  const tcs = computeTcsFromLibrary(
    msa,
    stripped.map((s) => s.idx),
    library,
  );
  const tcsColMean = computeTcsColumnMeans(msa, tcs);
  const trident = computeTrident(msa, matrix, alphabetSize);
  return { tcs, tcsColMean, trident };
}

describe("pairIndex", () => {
  it("packs upper triangle in row-major order", () => {
    expect(pairIndex(0, 1, 4)).toBe(0);
    expect(pairIndex(0, 2, 4)).toBe(1);
    expect(pairIndex(0, 3, 4)).toBe(2);
    expect(pairIndex(1, 2, 4)).toBe(3);
    expect(pairIndex(1, 3, 4)).toBe(4);
    expect(pairIndex(2, 3, 4)).toBe(5);
  });

  it("is symmetric in its arguments", () => {
    for (let n = 2; n <= 6; n++) {
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          expect(pairIndex(i, j, n)).toBe(pairIndex(j, i, n));
        }
      }
    }
  });

  it("throws when i === j", () => {
    expect(() => pairIndex(1, 1, 4)).toThrow();
  });
});

describe("stripGapsAndIndex", () => {
  it("removes gaps and indexes residues", () => {
    const { ungapped, idx } = stripGapsAndIndex("A-CT-");
    expect(ungapped).toBe("ACT");
    expect(Array.from(idx)).toEqual([0, -1, 1, 2, -1]);
  });

  it("uppercases residues", () => {
    expect(stripGapsAndIndex("acgt").ungapped).toBe("ACGT");
  });
});

describe("needlemanWunsch", () => {
  const protLookup = buildLookup(BLOSUM62);
  const dnaLookup = buildLookup(DNA_MATRIX);

  it("returns identity for equal sequences", () => {
    const r = needlemanWunsch("ACGT", "ACGT", dnaLookup, -10, -1);
    expect(Array.from(r)).toEqual([0, 1, 2, 3]);
  });

  it("places a gap when sequences differ by one indel", () => {
    // ACGT vs AGT — A aligns to A, C is in a gap, G to G, T to T
    const r = needlemanWunsch("ACGT", "AGT", dnaLookup, -10, -1);
    expect(Array.from(r)).toEqual([0, -1, 1, 2]);
  });

  it("handles empty target gracefully", () => {
    const r = needlemanWunsch("ACGT", "", dnaLookup, -10, -1);
    expect(Array.from(r)).toEqual([-1, -1, -1, -1]);
  });

  it("aligns identical protein sequences position-wise", () => {
    const r = needlemanWunsch("MEEPQS", "MEEPQS", protLookup, -11, -1);
    expect(Array.from(r)).toEqual([0, 1, 2, 3, 4, 5]);
  });
});

describe("matrixRange", () => {
  it("finds extrema for BLOSUM62", () => {
    const { min, max } = matrixRange(BLOSUM62);
    expect(max).toBe(11); // W/W
    expect(min).toBe(-4);
  });

  it("finds extrema for DNA_MATRIX", () => {
    const { min, max } = matrixRange(DNA_MATRIX);
    expect(max).toBe(5);
    expect(min).toBe(-4);
  });
});

describe("computeTrident", () => {
  it("returns 1 for fully conserved columns (identical sequences)", () => {
    const msa = makeMSA(["ACGT", "ACGT", "ACGT"]);
    const t = computeTrident(msa, DNA_MATRIX, 4);
    expect(t).toHaveLength(4);
    t.forEach((v) => expect(v).toBeCloseTo(1));
  });

  it("returns 0 for an all-gap column", () => {
    const msa = makeMSA(["-A", "-C", "-G"]);
    const t = computeTrident(msa, DNA_MATRIX, 4);
    expect(t[0]).toBe(0);
  });

  it("ranks a conserved column above a variable one", () => {
    const msa = makeMSA(["AA", "AC", "AT"]);
    const t = computeTrident(msa, DNA_MATRIX, 4);
    expect(t[0]).toBeGreaterThan(t[1]);
  });

  it("is invariant to row permutation", () => {
    const a = computeTrident(makeMSA(["AC", "AG", "AT"]), DNA_MATRIX, 4);
    const b = computeTrident(makeMSA(["AT", "AC", "AG"]), DNA_MATRIX, 4);
    expect(a).toEqual(b);
  });

  it("penalises gappy columns via G", () => {
    const noGap = computeTrident(makeMSA(["AA", "AA", "AA"]), DNA_MATRIX, 4);
    const withGap = computeTrident(makeMSA(["AA", "AA", "-A"]), DNA_MATRIX, 4);
    expect(withGap[0]).toBeLessThan(noGap[0]);
    expect(withGap[1]).toBeCloseTo(noGap[1]);
  });
});

describe("computeTcsFromLibrary", () => {
  it("scores every non-gap residue of identical sequences as fully consistent", () => {
    const msa = makeMSA(["ACGT", "ACGT", "ACGT"]);
    const { tcs } = runQualityPipeline(msa, "DNA");
    expect(tcs).toHaveLength(3);
    tcs.forEach((row) => {
      expect(row).toHaveLength(4);
      row.forEach((v) => expect(v).toBeCloseTo(1));
    });
  });

  it("scores a single sequence as fully consistent (no pairs)", () => {
    const { tcs } = runQualityPipeline(makeMSA(["ACGT"]), "DNA");
    expect(tcs).toHaveLength(1);
    tcs[0].forEach((v) => expect(v).toBe(1));
  });

  it("scores gap cells as 0", () => {
    const { tcs } = runQualityPipeline(makeMSA(["-A", "-C"]), "DNA");
    expect(tcs[0][0]).toBe(0);
    expect(tcs[1][0]).toBe(0);
  });

  it("column means are 0 for all-gap columns and 1 for fully consistent columns", () => {
    const { tcsColMean } = runQualityPipeline(makeMSA(["-A", "-A", "-A"]), "DNA");
    expect(tcsColMean[0]).toBe(0);
    expect(tcsColMean[1]).toBeCloseTo(1);
  });

  it("is invariant to inserting an all-gap column (per-residue)", () => {
    const a = runQualityPipeline(makeMSA(["ACGT", "ACGT", "AGGT"]), "DNA").tcs;
    const b = runQualityPipeline(makeMSA(["AC-GT", "AC-GT", "AG-GT"]), "DNA").tcs;
    for (let r = 0; r < a.length; r++) {
      // Original columns 0,1,2,3 map to gapped columns 0,1,3,4 (column 2 is the inserted gap)
      expect(b[r][0]).toBeCloseTo(a[r][0]);
      expect(b[r][1]).toBeCloseTo(a[r][1]);
      expect(b[r][3]).toBeCloseTo(a[r][2]);
      expect(b[r][4]).toBeCloseTo(a[r][3]);
      expect(b[r][2]).toBe(0); // all-gap column → cell is gap → score 0
    }
  });

  it("row permutation permutes the per-row scores accordingly", () => {
    const original = runQualityPipeline(makeMSA(["ACGT", "AGGT", "AC-T"]), "DNA").tcs;
    const permuted = runQualityPipeline(makeMSA(["AC-T", "ACGT", "AGGT"]), "DNA").tcs;
    // permuted row 0 ↔ original row 2, permuted row 1 ↔ original row 0, etc.
    expect(permuted[0]).toEqual(original[2]);
    expect(permuted[1]).toEqual(original[0]);
    expect(permuted[2]).toEqual(original[1]);
  });

  it("scores a mismatched residue lower than its consistent neighbours", () => {
    // Three identical sequences except row 2 differs at column 1: ACGT, ACGT, ATGT
    const { tcs } = runQualityPipeline(makeMSA(["ACGT", "ACGT", "ATGT"]), "DNA");
    // Column 1: rows 0, 1 share C; row 2 has T. The C↔C pair is well-supported,
    // but the C↔T pairings should reduce row 2's score most strongly.
    expect(tcs[0][1]).toBeGreaterThanOrEqual(tcs[2][1]);
    expect(tcs[1][1]).toBeGreaterThanOrEqual(tcs[2][1]);
  });
});

describe("buildPairwiseLibrary", () => {
  it("emits the expected number of pairs", () => {
    const ungapped = ["ACGT", "ACGT", "AGGT", "ATGT"];
    const lib = buildPairwiseLibrary(ungapped, buildLookup(DNA_MATRIX), -10, -1);
    expect(lib).toHaveLength(6);
    lib.forEach((entry) => expect(entry).toBeInstanceOf(Int32Array));
  });

  it("reports progress monotonically", () => {
    const seen: { current: number; total: number }[] = [];
    buildPairwiseLibrary(
      ["A", "C", "G", "T"],
      buildLookup(DNA_MATRIX),
      -10,
      -1,
      (current, total) => seen.push({ current, total }),
    );
    expect(seen.length).toBeGreaterThan(0);
    expect(seen[seen.length - 1].current).toBe(seen[seen.length - 1].total);
    for (let i = 1; i < seen.length; i++) {
      expect(seen[i].current).toBeGreaterThanOrEqual(seen[i - 1].current);
    }
  });
});
