import { create } from "zustand";

type NJStatus = "idle" | "running" | "done" | "error";

type NJState = {
  newick: string | null;
  status: NJStatus;
  error: string | null;
  progress: { current: number; total: number } | null;
  setRunning: () => void;
  setResult: (newick: string) => void;
  setError: (error: string) => void;
  setProgress: (current: number, total: number) => void;
};

export const useNJStore = create<NJState>((set) => ({
  newick: null,
  status: "idle",
  error: null,
  progress: null,
  setRunning: () => set({ status: "running", newick: null, error: null, progress: null }),
  setResult: (newick) => set({ newick, status: "done", progress: null }),
  setError: (error) => set({ error, status: "error", progress: null }),
  setProgress: (current, total) => set({ progress: { current, total } }),
}));
