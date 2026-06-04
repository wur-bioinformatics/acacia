export type SelectionMode = "replace" | "additive" | "toggle";

function clamp(v: number, lo: number, hi: number): number {
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}

export function pixelToCol(pxX: number, offsetX: number, scale: number, cellSize: number): number {
  return Math.floor((pxX - offsetX) / (cellSize * scale));
}

export function pixelToRow(
  pxY: number,
  offsetY: number,
  cellSize: number,
  showConsensus: boolean,
): number {
  const visualRow = Math.floor((pxY - offsetY) / cellSize);
  return showConsensus ? visualRow - 1 : visualRow;
}

export function pixelRectToColRange(
  startX: number,
  endX: number,
  offsetX: number,
  scale: number,
  cellSize: number,
  nCols: number,
): { colMin: number; colMax: number } | null {
  if (nCols <= 0) return null;
  const lo = Math.min(startX, endX);
  const hi = Math.max(startX, endX);
  const colMin = clamp(pixelToCol(lo, offsetX, scale, cellSize), 0, nCols - 1);
  const colMax = clamp(pixelToCol(hi, offsetX, scale, cellSize), 0, nCols - 1);
  if (colMax < 0 || colMin > nCols - 1) return null;
  return { colMin, colMax };
}

export function pixelRectToRowRange(
  startY: number,
  endY: number,
  offsetY: number,
  cellSize: number,
  nRows: number,
  showConsensus: boolean,
): { rowMin: number; rowMax: number } | null {
  if (nRows <= 0) return null;
  const lo = Math.min(startY, endY);
  const hi = Math.max(startY, endY);
  const rowMin = clamp(pixelToRow(lo, offsetY, cellSize, showConsensus), 0, nRows - 1);
  const rowMax = clamp(pixelToRow(hi, offsetY, cellSize, showConsensus), 0, nRows - 1);
  if (rowMax < 0 || rowMin > nRows - 1) return null;
  return { rowMin, rowMax };
}

export function applySelectionMode<T>(
  prev: Set<T>,
  range: Iterable<T>,
  mode: SelectionMode,
): Set<T> {
  if (mode === "replace") return new Set(range);
  const next = new Set(prev);
  if (mode === "additive") {
    for (const x of range) next.add(x);
  } else {
    for (const x of range) {
      if (next.has(x)) next.delete(x);
      else next.add(x);
    }
  }
  return next;
}

/** Build an inclusive integer range [lo..hi] as a Set. */
export function intRangeSet(lo: number, hi: number): Set<number> {
  const out = new Set<number>();
  for (let i = lo; i <= hi; i++) out.add(i);
  return out;
}
