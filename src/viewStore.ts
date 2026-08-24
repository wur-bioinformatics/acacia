import { create } from "zustand";

/**
 * Tab order mirrors the analysis pipeline: an alignment yields pairwise
 * distances, which in turn yield a tree.
 */
export const viewOptions = ["MSA", "Distances", "Tree"] as const;
export type View = (typeof viewOptions)[number];

interface ViewState {
  view: View;
  setView: (view: View) => void;
}

export const useViewStore = create<ViewState>((set) => ({
  view: "MSA",
  setView: (view) => set({ view }),
}));
