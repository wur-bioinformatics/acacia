import { create } from "zustand";
import type { DistanceResult } from "@holmrenser/nj";
import type { SubstitutionModel } from "../substitutionModels";

type NJStatus = "idle" | "running" | "done" | "error";

/** Model settings that fully determine a pairwise distance matrix. */
export type DistanceParams = {
  substitution_model: SubstitutionModel;
  /** Gamma rate-heterogeneity shape α, or null when uniform rates were used. */
  gamma_shape: number | null;
  /** Proportion of invariant sites, or null when no correction was applied. */
  p_invar: number | null;
};

export type NJParams = DistanceParams & {
  n_bootstrap_samples: number;
};

type NJState = {
  // ── Distances ───────────────────────────────────────────────────────────
  distanceMatrix: DistanceResult | null;
  avgDistance: number | null;
  distanceStatus: NJStatus;
  distanceError: string | null;
  distanceParams: DistanceParams | null;
  distanceStale: boolean;
  distanceCancel: (() => void) | null;
  // ── Tree ────────────────────────────────────────────────────────────────
  newick: string | null;
  status: NJStatus;
  error: string | null;
  progress: { current: number; total: number } | null;
  njParams: NJParams | null;
  isStale: boolean;
  cancel: (() => void) | null;

  setDistanceRunning: () => void;
  setDistanceResult: (
    distanceMatrix: DistanceResult,
    avgDistance: number,
    params: DistanceParams,
  ) => void;
  setDistanceError: (error: string) => void;
  setDistanceCancel: (cancel: (() => void) | null) => void;
  setDistanceCancelled: () => void;

  setRunning: () => void;
  setResult: (newick: string, distanceMatrix: DistanceResult, avgDistance: number, params: NJParams) => void;
  setError: (error: string) => void;
  setProgress: (current: number, total: number) => void;
  setCancel: (cancel: (() => void) | null) => void;
  setCancelled: () => void;
  /** Marks whichever results exist as out of date with the edited alignment. */
  markStale: () => void;
  /** Clears all tree/distance results (and aborts an in-flight run). Used when a new MSA is loaded. */
  reset: () => void;
};

const initialNJState = {
  distanceMatrix: null,
  avgDistance: null,
  distanceStatus: "idle" as NJStatus,
  distanceError: null,
  distanceParams: null,
  distanceStale: false,
  distanceCancel: null,
  newick: null,
  status: "idle" as NJStatus,
  error: null,
  progress: null,
  njParams: null,
  isStale: false,
  cancel: null,
};

export const useNJStore = create<NJState>((set, get) => ({
  ...initialNJState,

  setDistanceRunning: () =>
    set({
      distanceStatus: "running",
      distanceMatrix: null,
      avgDistance: null,
      distanceError: null,
      distanceStale: false,
    }),
  setDistanceResult: (distanceMatrix, avgDistance, params) =>
    set({
      distanceMatrix,
      avgDistance,
      distanceStatus: "done",
      distanceParams: params,
      distanceCancel: null,
    }),
  setDistanceError: (distanceError) =>
    set({ distanceError, distanceStatus: "error", distanceCancel: null }),
  setDistanceCancel: (distanceCancel) => set({ distanceCancel }),
  setDistanceCancelled: () => set({ distanceStatus: "idle", distanceCancel: null }),

  // A tree run recomputes distances as a by-product, but the existing matrix
  // stays visible in the Distances view until the new one lands.
  setRunning: () => set({ status: "running", newick: null, error: null, progress: null, isStale: false }),
  setResult: (newick, distanceMatrix, avgDistance, params) =>
    set({
      newick,
      status: "done",
      progress: null,
      njParams: params,
      cancel: null,
      distanceMatrix,
      avgDistance,
      distanceStatus: "done",
      distanceError: null,
      distanceStale: false,
      distanceParams: {
        substitution_model: params.substitution_model,
        gamma_shape: params.gamma_shape,
        p_invar: params.p_invar,
      },
    }),
  setError: (error) => set({ error, status: "error", progress: null, cancel: null }),
  setProgress: (current, total) => set({ progress: { current, total } }),
  setCancel: (cancel) => set({ cancel }),
  setCancelled: () => set({ status: "idle", progress: null, cancel: null }),
  markStale: () =>
    set((s) => ({
      isStale: s.status === "done" ? true : s.isStale,
      distanceStale: s.distanceStatus === "done" ? true : s.distanceStale,
    })),
  reset: () => {
    // Abort any in-flight run first so its (now stale) result can't repopulate
    // the store after we clear it; the worker promise rejects with CancelledError.
    get().cancel?.();
    get().distanceCancel?.();
    set({ ...initialNJState });
  },
}));
