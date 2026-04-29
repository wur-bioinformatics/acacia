import { create } from "zustand";
import type { MSAData } from "./MSA/types";
import { useNJStore } from "./NJ/njStore";

export type RenameEdit = { type: "rename"; originalId: string; newName: string };
export type RemoveRowEdit = { type: "remove_row"; originalId: string };
export type RemoveColEdit = { type: "remove_column"; originalIndex: number };
export type Edit = RenameEdit | RemoveRowEdit | RemoveColEdit;

type EditState = {
  originalMSA: MSAData;
  edits: Edit[];
  future: Edit[];
  setOriginalMSA: (msa: MSAData) => void;
  addEdit: (edit: Edit) => void;
  undo: () => void;
  redo: () => void;
  clearEdits: () => void;
};

export const useEditStore = create<EditState>((set) => ({
  originalMSA: [],
  edits: [],
  future: [],
  setOriginalMSA: (originalMSA) => set({ originalMSA, edits: [], future: [] }),
  addEdit: (edit) => {
    if (edit.type === "remove_row" || edit.type === "remove_column") {
      useNJStore.getState().markStale();
    }
    set((s) => ({ edits: [...s.edits, edit], future: [] }));
  },
  undo: () =>
    set((s) => {
      if (s.edits.length === 0) return s;
      const last = s.edits[s.edits.length - 1];
      return { edits: s.edits.slice(0, -1), future: [last, ...s.future] };
    }),
  redo: () =>
    set((s) => {
      if (s.future.length === 0) return s;
      const next = s.future[0];
      return { edits: [...s.edits, next], future: s.future.slice(1) };
    }),
  clearEdits: () => set({ edits: [], future: [] }),
}));
