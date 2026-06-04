import type { MSAData } from "../types";

/**
 * Per-row mean TCS, keyed by identifier, averaged over non-gap positions of the
 * row's current MSA sequence. Rows whose identifier is not present in the
 * current MSA, or whose row has no non-gap positions, are omitted.
 *
 * `tcs` is row-indexed in the canonical order at compute time; `tcsIdentifiers`
 * gives the identifier for each row in that ordering. The current `msa` may be
 * in a different display order — we look up each identifier in `msa` to find
 * its sequence (for gap masking).
 */
export function rowMeanTCS(
  tcs: number[][],
  msa: MSAData,
  tcsIdentifiers: string[],
): Map<string, number> {
  const seqByIdentifier = new Map<string, string>();
  for (const row of msa) seqByIdentifier.set(row.identifier, row.sequence);

  const result = new Map<string, number>();
  for (let i = 0; i < tcsIdentifiers.length; i++) {
    const id = tcsIdentifiers[i];
    const seq = seqByIdentifier.get(id);
    if (seq === undefined) continue;
    const scores = tcs[i];
    if (!scores) continue;

    let sum = 0;
    let count = 0;
    const L = Math.min(seq.length, scores.length);
    for (let c = 0; c < L; c++) {
      if (seq[c] === "-") continue;
      sum += scores[c];
      count++;
    }
    if (count === 0) continue;
    result.set(id, sum / count);
  }
  return result;
}
