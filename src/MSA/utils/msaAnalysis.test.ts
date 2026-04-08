import { describe, it, expect } from "vitest";
import {
  computeColumnStats,
  computeConsensus,
  computeConservationScores,
  analyseMSAColumns,
} from "./msaAnalysis";

const makeMSA = (sequences: string[]) =>
  sequences.map((sequence, i) => ({ identifier: `seq${i + 1}`, sequence }));

describe("computeColumnStats", () => {
  it("returns dominant char and score=1 for fully conserved column", () => {
    const stats = computeColumnStats(makeMSA(["AAA", "AAA", "AAA"]));
    expect(stats[0].dominantChar).toBe("A");
    expect(stats[0].score).toBe(1);
  });

  it("returns score=0 and dominantChar='-' for all-gap column", () => {
    const stats = computeColumnStats(makeMSA(["---", "---"]));
    expect(stats[0].dominantChar).toBe("-");
    expect(stats[0].score).toBe(0);
  });

  it("returns correct dominant and fractional score for mixed column", () => {
    // 2 A, 1 T → score = 2/3
    const stats = computeColumnStats(makeMSA(["A", "A", "T"]));
    expect(stats[0].dominantChar).toBe("A");
    expect(stats[0].score).toBeCloseTo(2 / 3);
  });

  it("returns counts excluding gaps", () => {
    const stats = computeColumnStats(makeMSA(["A", "-", "A"]));
    expect(stats[0].counts["A"]).toBe(2);
    expect(stats[0].counts["-"]).toBeUndefined();
  });
});

describe("computeConsensus and computeConservationScores consistency", () => {
  it("consensus derives correctly from stats", () => {
    // col 0: all A → A, col 1: all C → C, col 2: 2×G + 1×A → G
    const msa = makeMSA(["ACG", "ACG", "ACA"]);
    const stats = computeColumnStats(msa);
    const consensus = computeConsensus(stats);
    expect(consensus).toEqual(["A", "C", "G"]);
  });

  it("conservation scores derive correctly from stats", () => {
    const msa = makeMSA(["AAA", "AAA", "AAT"]);
    const stats = computeColumnStats(msa);
    const scores = computeConservationScores(stats);
    expect(scores[0]).toBe(1); // all A
    expect(scores[1]).toBe(1); // all A
    expect(scores[2]).toBeCloseTo(2 / 3); // 2 A, 1 T
  });

  it("consensus and conservation are consistent with the same stats object", () => {
    const msa = makeMSA(["ACG", "ATG", "ACG"]);
    const stats = computeColumnStats(msa);
    const consensus = computeConsensus(stats);
    const scores = computeConservationScores(stats);
    // each consensus char should match the dominant in the corresponding stat
    stats.forEach((stat, i) => {
      expect(consensus[i]).toBe(stat.dominantChar);
      expect(scores[i]).toBe(stat.score);
    });
  });
});

describe("analyseMSAColumns", () => {
  it("identifies conserved sites", () => {
    // col 0: all A → conserved
    const { conservedSites } = analyseMSAColumns(makeMSA(["AC", "AC", "AC"]));
    expect(conservedSites).toContain(0);
  });

  it("identifies variable sites", () => {
    // col 1: A and C → variable
    const { variableSites } = analyseMSAColumns(makeMSA(["AA", "AC", "AA"]));
    expect(variableSites).toContain(1);
    expect(variableSites).not.toContain(0);
  });

  it("identifies parsimony-informative sites", () => {
    // col 0: 2 A + 2 T → parsimony informative (both appear >1)
    const { parsimonyInformativeSites } = analyseMSAColumns(
      makeMSA(["A", "A", "T", "T"]),
    );
    expect(parsimonyInformativeSites).toContain(0);
  });

  it("excludes sites where only one state appears more than once from parsimony", () => {
    // col 0: 3 A + 1 T → T appears only once → not parsimony informative
    const { parsimonyInformativeSites } = analyseMSAColumns(
      makeMSA(["A", "A", "A", "T"]),
    );
    expect(parsimonyInformativeSites).not.toContain(0);
  });
});
