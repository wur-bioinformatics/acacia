import { create } from "zustand";
import type { DrawOptions, InteractionMode, SequenceType, TrackType } from "../types";

type DrawState = {
  drawOptions: DrawOptions;
  sequenceTypeOverride: SequenceType | null;
  dragState: { dragIndex: number; hoverIndex: number } | null;
  interactionMode: InteractionMode;
  hoverRow: number | null;
  activeTrack: TrackType | null;
  setDrawOptions: (
    opts: Partial<DrawOptions> | ((prev: DrawOptions) => Partial<DrawOptions>)
  ) => void;
  setSequenceTypeOverride: (type: SequenceType | null) => void;
  setDragState: (state: { dragIndex: number; hoverIndex: number } | null) => void;
  setInteractionMode: (mode: InteractionMode) => void;
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
  },
  sequenceTypeOverride: null,
  dragState: null,
  interactionMode: "hand",
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
  setInteractionMode: (interactionMode) => set({ interactionMode }),
  setHoverRow: (hoverRow) => set({ hoverRow }),
  setActiveTrack: (activeTrack) => set({ activeTrack }),
}));
