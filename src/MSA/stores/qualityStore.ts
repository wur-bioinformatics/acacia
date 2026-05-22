import { create } from "zustand";
import type { QualityStage } from "../types";

type QualityStatus = "idle" | "running" | "done" | "error";

type QualityState = {
  /** Per-column TRIDENT score, length L. */
  trident: number[] | null;
  /** Per-residue TCS score, indexed [row][col] in canonical (edited, unordered) MSA row order. */
  tcs: number[][] | null;
  /** Identifiers of rows in `tcs` at compute time — used to permute when the display order changes. */
  tcsIdentifiers: string[] | null;
  /** Column means of `tcs`, length L (mean over non-gap residues per column). */
  tcsColMean: number[] | null;
  status: QualityStatus;
  error: string | null;
  progress: { stage: QualityStage; current: number; total: number } | null;
  isStale: boolean;
  setRunning: () => void;
  setProgress: (stage: QualityStage, current: number, total: number) => void;
  setResult: (
    trident: number[],
    tcs: number[][],
    tcsColMean: number[],
    tcsIdentifiers: string[],
  ) => void;
  setError: (error: string) => void;
  markStale: () => void;
  reset: () => void;
};

const initial = {
  trident: null,
  tcs: null,
  tcsIdentifiers: null,
  tcsColMean: null,
  status: "idle" as QualityStatus,
  error: null,
  progress: null,
  isStale: false,
};

export const useQualityStore = create<QualityState>((set) => ({
  ...initial,
  setRunning: () => set({ ...initial, status: "running" }),
  setProgress: (stage, current, total) =>
    set({ progress: { stage, current, total } }),
  setResult: (trident, tcs, tcsColMean, tcsIdentifiers) =>
    set({
      trident,
      tcs,
      tcsColMean,
      tcsIdentifiers,
      status: "done",
      progress: null,
      error: null,
    }),
  setError: (error) => set({ error, status: "error", progress: null }),
  markStale: () => set((s) => (s.status === "done" ? { isStale: true } : s)),
  reset: () => set({ ...initial }),
}));
