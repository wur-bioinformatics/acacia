import { create } from "zustand";

export const viewOptions = ["MSA", "Tree", "Tree + MSA", "Distances"] as const;
export type View = (typeof viewOptions)[number];

interface ViewState {
  view: View;
  setView: (view: View) => void;
}

export const useViewStore = create<ViewState>((set) => ({
  view: "MSA",
  setView: (view) => set({ view }),
}));
