/** A "nice" step ladder — every step divides evenly into the next one that is a
 * multiple of it, so minor ticks always land on a whole number of columns. */
const STEPS = [
  1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000,
];

/** Minimum horizontal room a labelled tick needs before the labels start to
 * collide, in CSS pixels. */
const MIN_LABEL_SPACING = 64;

export type Tick = {
  /** 0-based column index the tick sits on. */
  col: number;
  /** Pixel offset of the centre of that column, relative to the canvas left edge. */
  x: number;
  /** 1-based position shown to the user; only set on major (labelled) ticks. */
  label: number | null;
};

/**
 * Pick the labelled-tick interval (in columns) for the current zoom level: the
 * smallest "nice" step that keeps labels at least MIN_LABEL_SPACING apart.
 */
export function pickTickStep(pxPerCol: number): number {
  for (const step of STEPS) {
    if (step * pxPerCol >= MIN_LABEL_SPACING) return step;
  }
  return STEPS[STEPS.length - 1];
}

/**
 * Ticks for the columns currently visible in the viewport. Major ticks carry a
 * 1-based label; minor ticks (five per major, when the step allows it) do not.
 *
 * Positions are 1-based for the user, so the label `50` sits on column index 49.
 */
export function computeTicks({
  nCols,
  width,
  offsetX,
  pxPerCol,
}: {
  nCols: number;
  width: number;
  offsetX: number;
  pxPerCol: number;
}): Tick[] {
  if (nCols <= 0 || width <= 0 || pxPerCol <= 0) return [];

  const majorStep = pickTickStep(pxPerCol);
  // Every ladder entry above 1 divides by 5 or 2, and majors are always ≥64px
  // apart, so minors land no closer than ~13px — no extra spacing guard needed.
  const divisor = majorStep % 5 === 0 ? 5 : majorStep % 2 === 0 ? 2 : 1;
  const minorStep = majorStep / divisor;

  const firstCol = Math.max(0, Math.floor(-offsetX / pxPerCol));
  const lastCol = Math.min(nCols - 1, Math.ceil((width - offsetX) / pxPerCol));
  if (lastCol < firstCol) return [];

  // Walk 1-based positions on the minor grid, starting at the first multiple at
  // or after the leftmost visible column.
  const firstPos = Math.max(
    minorStep,
    Math.ceil((firstCol + 1) / minorStep) * minorStep,
  );
  const ticks: Tick[] = [];
  for (let pos = firstPos; pos <= lastCol + 1; pos += minorStep) {
    const col = pos - 1;
    ticks.push({
      col,
      x: col * pxPerCol + pxPerCol / 2 + offsetX,
      label: pos % majorStep === 0 ? pos : null,
    });
  }
  return ticks;
}
