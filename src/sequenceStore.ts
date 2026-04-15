import { create } from "zustand";

// Single source of truth for the display order of sequences.
// Used by: MSA row rendering, tree leaf y-positions, distance matrix rows/columns.
//
// Populated by msaStore.setMSAData (load order) and by tree/index.tsx after NJ
// completes (syncFromTreeLeafOrder). Tree load takes precedence: it reorders MSA
// rows to match the tree's leaf traversal order.

type SequenceOrderState = {
  order: readonly string[]; // sequence identifiers in current display order
  selectedIdentifier: string | null; // shared selection across linked views

  setOrder: (order: string[]) => void;
  moveSequence: (fromIndex: number, toIndex: number) => void;
  // Reorders to match leafNames, appending any identifiers not present in the tree.
  syncFromTreeLeafOrder: (leafNames: string[]) => void;
  setSelectedIdentifier: (id: string | null) => void;
};

export const useSequenceStore = create<SequenceOrderState>((set) => ({
  order: [],
  selectedIdentifier: null,

  setOrder: (order) => set({ order }),

  moveSequence: (from, to) =>
    set((s) => {
      const next = [...s.order];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return { order: next };
    }),

  syncFromTreeLeafOrder: (leafNames) =>
    set((s) => {
      const inTree = new Set(leafNames);
      const extras = s.order.filter((id) => !inTree.has(id));
      return { order: [...leafNames, ...extras] };
    }),

  setSelectedIdentifier: (selectedIdentifier) => set({ selectedIdentifier }),
}));
