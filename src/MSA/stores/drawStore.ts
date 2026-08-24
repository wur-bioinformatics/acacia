import { create } from "zustand";
import type { DrawOptions, SequenceType, TrackType } from "../types";
import type { SelectionMode } from "../utils/selectionMath";

export type Selection = {
  rows: Set<string>;
  columns: Set<number>;
  lastRow: string | null;
  lastCol: number | null;
};

export type DragRect = {
  startX: number;
  startY: number;
  curX: number;
  curY: number;
  mode: SelectionMode;
} | null;

/** The alignment cell the pointer is currently over, plus the viewport coords
 * that produced it (the floating cursor tooltip is positioned from these). Only
 * set while the pointer is inside the alignment bounds. */
export type HoverCell = {
  /** 0-based row index into the displayed alignment, or null for the consensus row. */
  row: number | null;
  /** 0-based column index. */
  col: number;
  clientX: number;
  clientY: number;
};

export type InteractionMode = "pan" | "select";
export type SelectionAxis = "rows" | "columns";

const emptySelection: Selection = {
  rows: new Set(),
  columns: new Set(),
  lastRow: null,
  lastCol: null,
};

type DrawState = {
  drawOptions: DrawOptions;
  sequenceTypeOverride: SequenceType | null;
  dragState: { dragIndex: number; hoverIndex: number } | null;
  hoverRow: number | null;
  hoverCell: HoverCell | null;
  activeTrack: TrackType | null;
  selection: Selection;
  dragRect: DragRect;
  interactionMode: InteractionMode;
  selectionAxis: SelectionAxis;
  setDrawOptions: (
    opts: Partial<DrawOptions> | ((prev: DrawOptions) => Partial<DrawOptions>)
  ) => void;
  setSequenceTypeOverride: (type: SequenceType | null) => void;
  setDragState: (state: { dragIndex: number; hoverIndex: number } | null) => void;
  setHoverRow: (row: number | null) => void;
  setHoverCell: (cell: HoverCell | null) => void;
  setActiveTrack: (track: TrackType | null) => void;
  setSelection: (next: Selection | ((prev: Selection) => Selection)) => void;
  clearSelection: () => void;
  setDragRect: (rect: DragRect) => void;
  setInteractionMode: (mode: InteractionMode) => void;
  setSelectionAxis: (axis: SelectionAxis) => void;
  /** Clears selection/preview/track and resets the viewport when a new MSA is
   * loaded — these all reference the previous alignment. Display preferences
   * (colour scheme, sequence-type override, label/minimap toggles) are kept. */
  resetForNewMSA: () => void;
};

export const useDrawStore = create<DrawState>((set) => ({
  drawOptions: {
    showLetters: true,
    showConsensus: true,
    showOnlyDifferences: false,
    showLabels: window.innerWidth >= 768,
    showMinimap: true,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    isMinimap: false,
    cellSize: 16,
    colorStyle: "DNA",
    conservationThreshold: 0.9,
    highlightPattern: "",
    highlightUseRegex: false,
    darkMode: localStorage.getItem("theme") === "dark",
  },
  sequenceTypeOverride: null,
  dragState: null,
  hoverRow: null,
  hoverCell: null,
  activeTrack: null,
  selection: emptySelection,
  dragRect: null,
  interactionMode: "pan",
  selectionAxis: "columns",
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
  setHoverCell: (hoverCell) => set({ hoverCell }),
  setActiveTrack: (activeTrack) => set({ activeTrack }),
  setSelection: (next) =>
    set((s) => ({
      selection: typeof next === "function" ? next(s.selection) : next,
    })),
  clearSelection: () => set({ selection: emptySelection }),
  setDragRect: (dragRect) => set({ dragRect }),
  setInteractionMode: (interactionMode) => set({ interactionMode }),
  setSelectionAxis: (selectionAxis) => set({ selectionAxis }),
  resetForNewMSA: () =>
    set((s) => ({
      selection: emptySelection,
      dragRect: null,
      dragState: null,
      hoverRow: null,
      hoverCell: null,
      activeTrack: null,
      drawOptions: { ...s.drawOptions, offsetX: 0, offsetY: 0, scale: 1, highlightPattern: "" },
    })),
}));
