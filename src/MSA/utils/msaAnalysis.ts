import type { MSAData, MSAColumnAnalysis, MSAColumnStat } from "../types";

function columnChars(msaData: MSAData, col: number): string[] {
  return msaData.map((row) => row.sequence[col]);
}

/** Single pass over every column, producing consensus + conservation data. */
export function computeColumnStats(msaData: MSAData): MSAColumnStat[] {
  const nCols = msaData[0].sequence.length;
  return Array.from({ length: nCols }, (_, col) => {
    const counts = columnChars(msaData, col)
      .map((c) => c.toUpperCase())
      .filter((c) => c !== "-")
      .reduce<Record<string, number>>((acc, c) => {
        acc[c] = (acc[c] || 0) + 1;
        return acc;
      }, {});
    const total = Object.values(counts).reduce((s, n) => s + n, 0);
    const entries = Object.entries(counts);
    const dominantChar =
      entries.length === 0
        ? "-"
        : entries.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
    const score = total === 0 ? 0 : (counts[dominantChar] ?? 0) / total;
    return { dominantChar, score, counts };
  });
}

export function computeConsensus(stats: MSAColumnStat[]): string[] {
  return stats.map((s) => s.dominantChar);
}

export function computeConservationScores(stats: MSAColumnStat[]): number[] {
  return stats.map((s) => s.score);
}

export function analyseMSAColumns(msaData: MSAData): MSAColumnAnalysis {
  const nCols = msaData[0].sequence.length;

  return Array.from({ length: nCols }, (_, col) => {
    const counts = columnChars(msaData, col).reduce<Record<string, number>>(
      (acc, c) => {
        acc[c] = (acc[c] || 0) + 1;
        return acc;
      },
      {},
    );
    return { col, counts };
  }).reduce<MSAColumnAnalysis>(
    (acc, { col, counts }) => {
      const charCounts = Object.values(counts);
      if (Object.keys(counts).length === 1) {
        acc.conservedSites.push(col);
      } else {
        if (Math.min(...charCounts) > 1)
          acc.parsimonyInformativeSites.push(col);
        acc.variableSites.push(col);
      }
      return acc;
    },
    { parsimonyInformativeSites: [], conservedSites: [], variableSites: [] },
  );
}
