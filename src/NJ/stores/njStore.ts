import { create } from "zustand";
import type { DistanceResult } from "@holmrenser/nj";

type NJStatus = "idle" | "running" | "done" | "error";

export type NJParams = {
  substitution_model: string;
  n_bootstrap_samples: number;
  /** Gamma rate-heterogeneity shape α, or null when uniform rates were used. */
  gamma_shape: number | null;
  /** Proportion of invariant sites, or null when no correction was applied. */
  p_invar: number | null;
};

type NJState = {
  newick: string | null;
  distanceMatrix: DistanceResult | null;
  avgDistance: number | null;
  status: NJStatus;
  error: string | null;
  progress: { current: number; total: number } | null;
  njParams: NJParams | null;
  isStale: boolean;
  cancel: (() => void) | null;
  setRunning: () => void;
  setResult: (newick: string, distanceMatrix: DistanceResult, avgDistance: number, params: NJParams) => void;
  setError: (error: string) => void;
  setProgress: (current: number, total: number) => void;
  setCancel: (cancel: (() => void) | null) => void;
  setCancelled: () => void;
  markStale: () => void;
  /** Clears all tree/distance results (and aborts an in-flight run). Used when a new MSA is loaded. */
  reset: () => void;
};

const initialNJState = {
  newick: null,
  distanceMatrix: null,
  avgDistance: null,
  status: "idle" as NJStatus,
  error: null,
  progress: null,
  njParams: null,
  isStale: false,
  cancel: null,
};

export const useNJStore = create<NJState>((set, get) => ({
  ...initialNJState,
  setRunning: () => set({ status: "running", newick: null, distanceMatrix: null, avgDistance: null, error: null, progress: null, isStale: false }),
  setResult: (newick, distanceMatrix, avgDistance, params) =>
    set({ newick, distanceMatrix, avgDistance, status: "done", progress: null, njParams: params, cancel: null }),
  setError: (error) => set({ error, status: "error", progress: null, cancel: null }),
  setProgress: (current, total) => set({ progress: { current, total } }),
  setCancel: (cancel) => set({ cancel }),
  setCancelled: () => set({ status: "idle", progress: null, cancel: null }),
  markStale: () => set((s) => s.status === "done" ? { isStale: true } : s),
  reset: () => {
    // Abort any in-flight run first so its (now stale) result can't repopulate
    // the store after we clear it; the worker promise rejects with CancelledError.
    get().cancel?.();
    set({ ...initialNJState });
  },
}));
