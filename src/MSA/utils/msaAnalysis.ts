import type { MSAData } from "../types";

export type ColumnStat = {
  dominantChar: string;
  /** Fraction of non-gap positions that match the dominant character (0–1). */
  score: number;
  counts: Record<string, number>;
};

/** Single pass over every column, producing consensus + conservation data. */
export function computeColumnStats(msaData: MSAData): ColumnStat[] {
  const nCols = msaData[0].sequence.length;
  const nRows = msaData.length;
  const stats: ColumnStat[] = [];
  for (let col = 0; col < nCols; col++) {
    const counts: Record<string, number> = {};
    let total = 0;
    for (let row = 0; row < nRows; row++) {
      const char = msaData[row].sequence[col].toUpperCase();
      if (char !== "-") {
        counts[char] = (counts[char] || 0) + 1;
        total++;
      }
    }
    const entries = Object.entries(counts);
    const dominantChar =
      entries.length === 0
        ? "-"
        : entries.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
    const score = total === 0 ? 0 : (counts[dominantChar] ?? 0) / total;
    stats.push({ dominantChar, score, counts });
  }
  return stats;
}

export function computeConsensus(stats: ColumnStat[]): string[] {
  return stats.map((s) => s.dominantChar);
}

export function computeConservationScores(stats: ColumnStat[]): number[] {
  return stats.map((s) => s.score);
}

export function analyseMSAColumns(msaData: MSAData): {
  parsimonyInformativeSites: number[];
  conservedSites: number[];
  variableSites: number[];
} {
  const parsimonyInformativeSites: number[] = [];
  const conservedSites: number[] = [];
  const variableSites: number[] = [];

  const nCols = msaData[0].sequence.length;
  const nRows = msaData.length;

  for (let col = 0; col < nCols; col++) {
    const counts: Record<string, number> = {};
    for (let row = 0; row < nRows; row++) {
      const char = msaData[row].sequence[col];
      counts[char] = (counts[char] || 0) + 1;
    }
    const charCounts = Object.values(counts);
    if (Object.keys(counts).length === 1) {
      conservedSites.push(col);
    } else {
      if (Math.min(...charCounts) > 1) parsimonyInformativeSites.push(col);
      variableSites.push(col);
    }
  }

  return { parsimonyInformativeSites, conservedSites, variableSites };
}
