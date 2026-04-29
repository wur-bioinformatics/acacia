import { create } from "zustand";
import type { DistanceResult } from "@holmrenser/nj";

type NJStatus = "idle" | "running" | "done" | "error";

export type NJParams = {
  substitution_model: string;
  n_bootstrap_samples: number;
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
  setRunning: () => void;
  setResult: (newick: string, distanceMatrix: DistanceResult, avgDistance: number, params: NJParams) => void;
  setError: (error: string) => void;
  setProgress: (current: number, total: number) => void;
  markStale: () => void;
};

export const useNJStore = create<NJState>((set) => ({
  newick: null,
  distanceMatrix: null,
  avgDistance: null,
  status: "idle",
  error: null,
  progress: null,
  njParams: null,
  isStale: false,
  setRunning: () => set({ status: "running", newick: null, distanceMatrix: null, avgDistance: null, error: null, progress: null, isStale: false }),
  setResult: (newick, distanceMatrix, avgDistance, params) =>
    set({ newick, distanceMatrix, avgDistance, status: "done", progress: null, njParams: params }),
  setError: (error) => set({ error, status: "error", progress: null }),
  setProgress: (current, total) => set({ progress: { current, total } }),
  markStale: () => set((s) => s.status === "done" ? { isStale: true } : s),
}));
