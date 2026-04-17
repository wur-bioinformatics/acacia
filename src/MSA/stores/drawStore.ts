import { create } from "zustand";
import type { DrawOptions, ScrollMode, SequenceType, TrackType } from "../types";

type DrawState = {
  drawOptions: DrawOptions;
  sequenceTypeOverride: SequenceType | null;
  dragState: { dragIndex: number; hoverIndex: number } | null;
  scrollMode: ScrollMode;
  hoverRow: number | null;
  activeTrack: TrackType | null;
  setDrawOptions: (
    opts: Partial<DrawOptions> | ((prev: DrawOptions) => Partial<DrawOptions>)
  ) => void;
  setSequenceTypeOverride: (type: SequenceType | null) => void;
  setDragState: (state: { dragIndex: number; hoverIndex: number } | null) => void;
  setScrollMode: (mode: ScrollMode) => void;
  setHoverRow: (row: number | null) => void;
  setActiveTrack: (track: TrackType | null) => void;
};

export const useDrawStore = create<DrawState>((set) => ({
  drawOptions: {
    showLetters: true,
    showConsensus: true,
    showLabels: window.innerWidth >= 768,
    showMinimap: true,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    isMinimap: false,
    cellSize: 16,
    colorStyle: "DNA",
    highlightPattern: "",
    highlightUseRegex: false,
    darkMode: localStorage.getItem("theme") === "dark",
  },
  sequenceTypeOverride: null,
  dragState: null,
  scrollMode: "zoom",
  hoverRow: null,
  activeTrack: null,
  setDrawOptions: (options) =>
    set((state) => ({
      drawOptions:
        typeof options === "function"
          ? { ...state.drawOptions, ...options(state.drawOptions) }
          : { ...state.drawOptions, ...options },
    })),
  setSequenceTypeOverride: (sequenceTypeOverride) => set({ sequenceTypeOverride }),
  setDragState: (dragState) => set({ dragState }),
  setScrollMode: (scrollMode) => set({ scrollMode }),
  setHoverRow: (hoverRow) => set({ hoverRow }),
  setActiveTrack: (activeTrack) => set({ activeTrack }),
}));
