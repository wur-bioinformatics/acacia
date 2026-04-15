import { create } from "zustand";
import type { DrawOptions, SequenceType } from "../types";

type DrawState = {
  drawOptions: DrawOptions;
  sequenceTypeOverride: SequenceType | null;
  setDrawOptions: (
    opts: Partial<DrawOptions> | ((prev: DrawOptions) => Partial<DrawOptions>)
  ) => void;
  setSequenceTypeOverride: (type: SequenceType | null) => void;
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
    highlightPattern: "",
    highlightUseRegex: false,
  },
  sequenceTypeOverride: null,
  setDrawOptions: (options) =>
    set((state) => ({
      drawOptions:
        typeof options === "function"
          ? { ...state.drawOptions, ...options(state.drawOptions) }
          : { ...state.drawOptions, ...options },
    })),
  setSequenceTypeOverride: (sequenceTypeOverride) => set({ sequenceTypeOverride }),
}));
