import { create } from "zustand";
import type { DrawOptions, SequenceType, TrackType } from "../types";

type DrawState = {
  drawOptions: DrawOptions;
  sequenceTypeOverride: SequenceType | null;
  dragState: { dragIndex: number; hoverIndex: number } | null;
  hoverRow: number | null;
  activeTrack: TrackType | null;
  selectedColumn: number | null;
  setDrawOptions: (
    opts: Partial<DrawOptions> | ((prev: DrawOptions) => Partial<DrawOptions>)
  ) => void;
  setSequenceTypeOverride: (type: SequenceType | null) => void;
  setDragState: (state: { dragIndex: number; hoverIndex: number } | null) => void;
  setHoverRow: (row: number | null) => void;
  setActiveTrack: (track: TrackType | null) => void;
  setSelectedColumn: (col: number | null) => void;
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
  hoverRow: null,
  activeTrack: null,
  selectedColumn: null,
  setDrawOptions: (options) =>
    set((state) => ({
      drawOptions:
        typeof options === "function"
          ? { ...state.drawOptions, ...options(state.drawOptions) }
          : { ...state.drawOptions, ...options },
    })),
  setSequenceTypeOverride: (sequenceTypeOverride) => set({ sequenceTypeOverride }),
  setDragState: (dragState) => set({ dragState }),
  setHoverRow: (hoverRow) => set({ hoverRow }),
  setActiveTrack: (activeTrack) => set({ activeTrack }),
  setSelectedColumn: (selectedColumn) => set({ selectedColumn }),
}));
