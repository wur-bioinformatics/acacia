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

  tridentStatus: QualityStatus;
  tridentError: string | null;
  tridentStale: boolean;
  tridentCancel: (() => void) | null;

  tcsStatus: QualityStatus;
  tcsError: string | null;
  tcsStale: boolean;
  tcsProgress: { stage: QualityStage; current: number; total: number } | null;
  tcsCancel: (() => void) | null;

  setTridentRunning: () => void;
  setTridentResult: (trident: number[]) => void;
  setTridentError: (error: string) => void;
  setTridentCancel: (cancel: (() => void) | null) => void;
  setTridentCancelled: () => void;

  setTcsRunning: () => void;
  setTcsProgress: (stage: QualityStage, current: number, total: number) => void;
  setTcsResult: (tcs: number[][], tcsColMean: number[], tcsIdentifiers: string[]) => void;
  setTcsError: (error: string) => void;
  setTcsCancel: (cancel: (() => void) | null) => void;
  setTcsCancelled: () => void;

  /** Mark both metrics stale (called when the alignment is edited). */
  markStale: () => void;
  reset: () => void;
};

const initial = {
  trident: null,
  tcs: null,
  tcsIdentifiers: null,
  tcsColMean: null,
  tridentStatus: "idle" as QualityStatus,
  tridentError: null,
  tridentStale: false,
  tridentCancel: null,
  tcsStatus: "idle" as QualityStatus,
  tcsError: null,
  tcsStale: false,
  tcsProgress: null,
  tcsCancel: null,
};

export const useQualityStore = create<QualityState>((set, get) => ({
  ...initial,
  setTridentRunning: () =>
    set({ trident: null, tridentStatus: "running", tridentError: null, tridentStale: false }),
  setTridentResult: (trident) =>
    set({ trident, tridentStatus: "done", tridentError: null, tridentStale: false, tridentCancel: null }),
  setTridentError: (error) => set({ tridentError: error, tridentStatus: "error", tridentCancel: null }),
  setTridentCancel: (cancel) => set({ tridentCancel: cancel }),
  setTridentCancelled: () => set({ tridentStatus: "idle", tridentCancel: null }),

  setTcsRunning: () =>
    set({
      tcs: null,
      tcsColMean: null,
      tcsIdentifiers: null,
      tcsStatus: "running",
      tcsError: null,
      tcsStale: false,
      tcsProgress: null,
    }),
  setTcsProgress: (stage, current, total) =>
    set({ tcsProgress: { stage, current, total } }),
  setTcsResult: (tcs, tcsColMean, tcsIdentifiers) =>
    set({
      tcs,
      tcsColMean,
      tcsIdentifiers,
      tcsStatus: "done",
      tcsProgress: null,
      tcsError: null,
      tcsStale: false,
      tcsCancel: null,
    }),
  setTcsError: (error) => set({ tcsError: error, tcsStatus: "error", tcsProgress: null, tcsCancel: null }),
  setTcsCancel: (cancel) => set({ tcsCancel: cancel }),
  setTcsCancelled: () => set({ tcsStatus: "idle", tcsProgress: null, tcsCancel: null }),

  markStale: () =>
    set((s) => ({
      tridentStale: s.tridentStatus === "done" ? true : s.tridentStale,
      tcsStale: s.tcsStatus === "done" ? true : s.tcsStale,
    })),
  reset: () => {
    // Abort any in-flight computation first so its (now stale) result can't
    // repopulate the store after we clear it; the worker promise rejects with
    // CancelledError (caught and ignored by the caller).
    const { tridentCancel, tcsCancel } = get();
    tridentCancel?.();
    tcsCancel?.();
    set({ ...initial });
  },
}));
