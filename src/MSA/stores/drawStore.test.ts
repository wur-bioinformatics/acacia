import { describe, it, expect, beforeEach } from "vitest";
import { useDrawStore } from "./drawStore";

beforeEach(() => {
  // Reset store to initial state between tests
  useDrawStore.setState({
    drawOptions: {
      showLetters: true,
      showConsensus: true,
      showLabels: true,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      isMinimap: false,
      cellSize: 16,
      colorStyle: "DNA",
      isConservation: false,
    },
  });
});

describe("drawStore setDrawOptions", () => {
  it("merges partial updates without clobbering other fields", () => {
    useDrawStore.getState().setDrawOptions({ showLetters: false });
    const opts = useDrawStore.getState().drawOptions;
    expect(opts.showLetters).toBe(false);
    expect(opts.showConsensus).toBe(true); // unchanged
    expect(opts.scale).toBe(1); // unchanged
  });

  it("supports function updater form", () => {
    useDrawStore.getState().setDrawOptions((prev) => ({ scale: prev.scale * 2 }));
    expect(useDrawStore.getState().drawOptions.scale).toBe(2);
  });

  it("function updater does not clobber other fields", () => {
    useDrawStore.getState().setDrawOptions((prev) => ({ offsetX: prev.offsetX + 10 }));
    const opts = useDrawStore.getState().drawOptions;
    expect(opts.offsetX).toBe(10);
    expect(opts.colorStyle).toBe("DNA"); // unchanged
  });

  it("can update colorStyle", () => {
    useDrawStore.getState().setDrawOptions({ colorStyle: "AA ClustalX" });
    expect(useDrawStore.getState().drawOptions.colorStyle).toBe("AA ClustalX");
  });
});
