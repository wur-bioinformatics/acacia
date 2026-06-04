/**
 * Pure threshold → selection logic for the Edit dropdown's "select by metric"
 * sliders. Every slider feeds the same persistent selection: column criteria
 * contribute to `columns`, row criteria to `rows`. A threshold of 0 disables
 * that criterion. The result is the *union* of all active criteria — the
 * component merges it with any manual selection.
 *
 * Direction of each comparison is fixed by what "interesting" means for the
 * metric: conservation selects well-conserved columns (≥), quality/consistency
 * scores select poorly-supported columns/rows (<), and gap fractions select
 * gappy columns/rows (>).
 */
export type ThresholdCriteria = {
  /** Per-column conservation (identity 0–1). Selects columns ≥ threshold. */
  conservation: number[];
  conservationThreshold: number;
  /** Per-column TRIDENT score (null when not computed). Selects columns < threshold. */
  trident: number[] | null;
  tridentThreshold: number;
  /** Per-column mean TCS (null when not computed). Selects columns < threshold. */
  tcsColMean: number[] | null;
  tcsColThreshold: number;
  /** Per-column gap fraction (0–1). Selects columns > threshold. */
  colGaps: number[];
  colGapThreshold: number;
  /** Per-row mean TCS keyed by identifier (null when not computed). Selects rows < threshold. */
  rowTcsMeans: Map<string, number> | null;
  rowTcsThreshold: number;
  /** Per-row gap fraction keyed by identifier. Selects rows > threshold. */
  rowGaps: Map<string, number>;
  rowGapThreshold: number;
};

export function computeThresholdSelection(c: ThresholdCriteria): {
  columns: Set<number>;
  rows: Set<string>;
} {
  const columns = new Set<number>();
  if (c.conservationThreshold > 0) {
    for (let i = 0; i < c.conservation.length; i++) {
      if (c.conservation[i] >= c.conservationThreshold) columns.add(i);
    }
  }
  if (c.trident && c.tridentThreshold > 0) {
    for (let i = 0; i < c.trident.length; i++) {
      if (c.trident[i] < c.tridentThreshold) columns.add(i);
    }
  }
  if (c.tcsColMean && c.tcsColThreshold > 0) {
    for (let i = 0; i < c.tcsColMean.length; i++) {
      if (c.tcsColMean[i] < c.tcsColThreshold) columns.add(i);
    }
  }
  if (c.colGapThreshold > 0) {
    for (let i = 0; i < c.colGaps.length; i++) {
      if (c.colGaps[i] > c.colGapThreshold) columns.add(i);
    }
  }

  const rows = new Set<string>();
  if (c.rowTcsMeans && c.rowTcsThreshold > 0) {
    for (const [id, mean] of c.rowTcsMeans) {
      if (mean < c.rowTcsThreshold) rows.add(id);
    }
  }
  if (c.rowGapThreshold > 0) {
    for (const [id, frac] of c.rowGaps) {
      if (frac > c.rowGapThreshold) rows.add(id);
    }
  }

  return { columns, rows };
}
