import type { MSAData } from "../types";

const GAP = "-";

/**
 * Per-column gap fraction (0–1): the fraction of rows whose residue in that
 * column is a gap. Length equals the alignment width (length of the first row);
 * returns an empty array for an empty alignment.
 */
export function columnGapFractions(msa: MSAData): number[] {
  const nRows = msa.length;
  if (nRows === 0) return [];
  const nCols = msa[0].sequence.length;
  const out = new Array<number>(nCols).fill(0);
  for (let c = 0; c < nCols; c++) {
    let gaps = 0;
    for (let r = 0; r < nRows; r++) {
      if (msa[r].sequence[c] === GAP) gaps++;
    }
    out[c] = gaps / nRows;
  }
  return out;
}

/**
 * Per-row gap fraction (0–1), keyed by identifier: the fraction of positions in
 * the row that are gaps. Rows with zero length are omitted.
 */
export function rowGapFractions(msa: MSAData): Map<string, number> {
  const out = new Map<string, number>();
  for (const { identifier, sequence } of msa) {
    const len = sequence.length;
    if (len === 0) continue;
    let gaps = 0;
    for (let c = 0; c < len; c++) {
      if (sequence[c] === GAP) gaps++;
    }
    out.set(identifier, gaps / len);
  }
  return out;
}
