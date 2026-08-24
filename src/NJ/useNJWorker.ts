import { useCallback, useEffect, useRef } from "react";
import type { DistanceResult } from "@holmrenser/nj";
import { DistanceOptions, NJMessage, NJOptions, NJResultMessage } from "./types";
import workerUrl from "./workers/njWorker.ts?worker&url";

type NJRunResult = { newick: string; distanceMatrix: DistanceResult; avgDistance: number };
type DistanceRunResult = { distanceMatrix: DistanceResult; avgDistance: number };

export class CancelledError extends Error {
  constructor() {
    super("Cancelled");
    this.name = "CancelledError";
  }
}

/** Wraps an error thrown by nj.rs, preserving the stable `code` (the original `Error.name`). */
export class NJError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = "NJError";
    this.code = code;
  }
}

/** User-facing messages keyed by nj.rs's stable error codes (see `nj.d.ts`). */
const NJ_ERROR_MESSAGES: Record<string, string> = {
  EmptyMsa: "The alignment is empty.",
  EmptySequence: "One or more sequences are empty.",
  SequenceLengthMismatch: "Sequences have unequal lengths — the input must be aligned.",
  DuplicateIdentifier: "Two or more sequences share the same name.",
  IncompatibleModel: "The chosen substitution model is incompatible with the detected sequence type.",
  InvalidNJConfig: "Invalid analysis configuration.",
};

export default function useNJWorker() {
  const workerRef = useRef<Worker | null>(null);
  const pendingRejectsRef = useRef<Set<(err: Error) => void>>(new Set());

  useEffect(() => {
    const worker = new Worker(workerUrl, { type: "module" });
    workerRef.current = worker;
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const cancel = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = new Worker(workerUrl, { type: "module" });
    }
    const rejects = Array.from(pendingRejectsRef.current);
    pendingRejectsRef.current.clear();
    for (const reject of rejects) reject(new CancelledError());
  }, []);

  /**
   * Posts `message` to the worker and settles when it answers. `onResult`
   * translates a matching result message into the resolved value; any other
   * result type is ignored, so distance and NJ runs can share one worker.
   */
  const run = useCallback(<T,>(
    message: NJMessage,
    onResult: (msg: NJResultMessage) => T | undefined,
    onProgress?: (current: number, total: number) => void,
  ): Promise<T> => {
    return new Promise((resolve, reject) => {
      if (!workerRef.current) {
        reject(new Error("NJ worker not initialized"));
        return;
      }
      const worker = workerRef.current;

      const cleanup = () => {
        pendingRejectsRef.current.delete(reject);
        worker.removeEventListener("message", handler);
        worker.removeEventListener("error", errorHandler);
      };

      const handler = (event: MessageEvent<NJResultMessage>) => {
        const msg = event.data;
        if (msg.type === "njError") {
          cleanup();
          const friendly = msg.code ? NJ_ERROR_MESSAGES[msg.code] : undefined;
          reject(new NJError(friendly ?? msg.error, msg.code));
          return;
        }
        if (msg.type === "njProgress") {
          onProgress?.(msg.current, msg.total);
          return;
        }
        const result = onResult(msg);
        if (result !== undefined) {
          cleanup();
          resolve(result);
        }
      };

      const errorHandler = (event: ErrorEvent) => {
        cleanup();
        reject(new Error(event.message ?? "Worker error"));
      };
      pendingRejectsRef.current.add(reject);
      worker.addEventListener("message", handler);
      worker.addEventListener("error", errorHandler);
      worker.postMessage(message);
    });
  }, []);

  const runNJ = useCallback((njOptions: NJOptions): Promise<NJRunResult> => {
    const { onProgress, ...workerOptions } = njOptions;
    return run<NJRunResult>(
      { type: "runNJ", data: workerOptions },
      (msg) =>
        msg.type === "njResult"
          ? { newick: msg.newick, distanceMatrix: msg.distanceMatrix, avgDistance: msg.avgDistance }
          : undefined,
      onProgress,
    );
  }, [run]);

  /** Distances only — no NJ, no bootstrap. */
  const runDistances = useCallback((distanceOptions: DistanceOptions): Promise<DistanceRunResult> => {
    return run<DistanceRunResult>({ type: "runDistances", data: distanceOptions }, (msg) =>
      msg.type === "distanceResult"
        ? { distanceMatrix: msg.distanceMatrix, avgDistance: msg.avgDistance }
        : undefined,
    );
  }, [run]);

  return { runNJ, runDistances, cancel };
}
