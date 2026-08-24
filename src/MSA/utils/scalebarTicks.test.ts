import { describe, it, expect } from "vitest";
import { computeTicks, pickTickStep } from "./scalebarTicks";

describe("pickTickStep", () => {
  it("picks a step that keeps labels at least 64px apart", () => {
    expect(pickTickStep(16) * 16).toBeGreaterThanOrEqual(64);
    expect(pickTickStep(1) * 1).toBeGreaterThanOrEqual(64);
    expect(pickTickStep(0.05) * 0.05).toBeGreaterThanOrEqual(64);
  });

  it("zooms the step up as columns get narrower", () => {
    expect(pickTickStep(16)).toBeLessThan(pickTickStep(1));
    expect(pickTickStep(1)).toBeLessThan(pickTickStep(0.1));
  });

  it("saturates at the largest step instead of returning undefined", () => {
    expect(pickTickStep(1e-9)).toBe(25000);
  });
});

describe("computeTicks", () => {
  const base = { nCols: 1000, width: 800, offsetX: 0, pxPerCol: 16 };

  it("labels 1-based positions on the column before them", () => {
    const ticks = computeTicks(base);
    const major = ticks.filter((t) => t.label !== null);
    expect(major[0].label).toBe(5);
    expect(major[0].col).toBe(4);
  });

  it("centres ticks on their column", () => {
    const ticks = computeTicks(base);
    expect(ticks[0].x).toBe(ticks[0].col * 16 + 8);
  });

  it("only emits ticks inside the viewport", () => {
    const ticks = computeTicks({ ...base, offsetX: -1600 });
    expect(ticks.every((t) => t.x >= -16 && t.x <= 816)).toBe(true);
    expect(ticks[0].col).toBeGreaterThanOrEqual(99);
  });

  it("never runs past the end of the alignment", () => {
    const ticks = computeTicks({ ...base, nCols: 12, pxPerCol: 16 });
    expect(Math.max(...ticks.map((t) => t.col))).toBeLessThan(12);
  });

  it("emits minor ticks between the labelled ones", () => {
    const ticks = computeTicks(base);
    expect(ticks.some((t) => t.label === null)).toBe(true);
  });

  it("keeps minor ticks legible at every zoom level", () => {
    for (const pxPerCol of [0.02, 0.5, 1, 4, 16, 40]) {
      const ticks = computeTicks({ ...base, nCols: 200000, pxPerCol });
      const gaps = ticks.slice(1).map((t, i) => t.x - ticks[i].x);
      expect(Math.min(...gaps)).toBeGreaterThanOrEqual(6);
    }
  });

  it("labels every tick once each column has its own label", () => {
    const ticks = computeTicks({ ...base, pxPerCol: 80 });
    expect(ticks.every((t) => t.label !== null)).toBe(true);
  });

  it("returns nothing for an empty or unmeasured alignment", () => {
    expect(computeTicks({ ...base, nCols: 0 })).toEqual([]);
    expect(computeTicks({ ...base, width: 0 })).toEqual([]);
  });
});
