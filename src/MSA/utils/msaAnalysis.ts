import type { MSAData, MSAColumnAnalysis, MSAColumnStat } from "../types";

function columnChars(msaData: MSAData, col: number): string[] {
  return msaData.map((row) => row.sequence[col]);
}

/** Single pass over every column, producing consensus + conservation data. */
export function computeColumnStats(msaData: MSAData): MSAColumnStat[] {
  const nCols = msaData[0].sequence.length;
  const nRows = msaData.length;
  const stats = new Array<MSAColumnStat>(nCols);
  for (let col = 0; col < nCols; col++) {
    // One pass over the column, no intermediate arrays — this runs over every
    // cell on load (consensus row) so allocation matters for large alignments.
    const counts: Record<string, number> = {};
    let total = 0;
    let dominantChar = "-";
    let dominantCount = 0;
    for (let row = 0; row < nRows; row++) {
      const ch = msaData[row].sequence[col];
      if (ch === "-") continue;
      const u = ch.toUpperCase();
      const n = (counts[u] = (counts[u] ?? 0) + 1);
      total++;
      if (n > dominantCount) {
        dominantCount = n;
        dominantChar = u;
      }
    }
    const score = total === 0 ? 0 : dominantCount / total;
    const identity = nRows === 0 ? 0 : dominantCount / nRows;
    stats[col] = { dominantChar, score, identity, counts };
  }
  return stats;
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
