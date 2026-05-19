import { create } from "zustand";

interface DocsState {
  open: boolean;
  scrollTarget: string | null;
  openDocs: (anchor?: string) => void;
  closeDocs: () => void;
}

export const useDocsStore = create<DocsState>((set) => ({
  open: false,
  scrollTarget: null,
  openDocs: (anchor) => set({ open: true, scrollTarget: anchor ?? null }),
  closeDocs: () => set({ open: false, scrollTarget: null }),
}));
