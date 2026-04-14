import { create } from "zustand";
import type { DrawOptions } from "../types";

type DrawState = {
  drawOptions: DrawOptions;
  setDrawOptions: (
    opts: Partial<DrawOptions> | ((prev: DrawOptions) => Partial<DrawOptions>)
  ) => void;
};

export const useDrawStore = create<DrawState>((set) => ({
  drawOptions: {
    showLetters: true,
    showConsensus: true,
    showLabels: window.innerWidth >= 768,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    isMinimap: false,
    cellSize: 16,
    colorStyle: "DNA",
    isConservation: false,
  },
  setDrawOptions: (options) =>
    set((state) => ({
      drawOptions:
        typeof options === "function"
          ? { ...state.drawOptions, ...options(state.drawOptions) }
          : { ...state.drawOptions, ...options },
    })),
}));
