import { useCallback, useEffect, useRef } from "react";
import workerUrl from "../workers/qualityWorker.ts?worker&url";
import { CancelledError } from "../../NJ/useNJWorker";
import type {
  MSAData,
  QualityResponseMessage,
  QualityStage,
  SequenceType,
} from "../types";

export type TridentRunOptions = {
  msaData: MSAData;
  sequenceType: SequenceType;
};

export type TcsRunOptions = {
  msaData: MSAData;
  sequenceType: SequenceType;
  onProgress?: (stage: QualityStage, current: number, total: number) => void;
};

export default function useQualityWorker() {
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

  const runTrident = useCallback((opts: TridentRunOptions): Promise<number[]> => {
    return new Promise((resolve, reject) => {
      if (!workerRef.current) {
        reject(new Error("Quality worker not initialized"));
        return;
      }
      const { msaData, sequenceType } = opts;
      const worker = workerRef.current;

      const cleanup = () => {
        pendingRejectsRef.current.delete(reject);
        worker.removeEventListener("message", handler);
        worker.removeEventListener("error", errorHandler);
      };
      const handler = (event: MessageEvent<QualityResponseMessage>) => {
        const msg = event.data;
        if (msg.type === "tridentResult") {
          cleanup();
          resolve(msg.trident);
        } else if (msg.type === "qualityError" && msg.metric === "trident") {
          cleanup();
          reject(new Error(msg.error));
        }
      };
      const errorHandler = (event: ErrorEvent) => {
        cleanup();
        reject(new Error(event.message ?? "Quality worker error"));
      };

      pendingRejectsRef.current.add(reject);
      worker.addEventListener("message", handler);
      worker.addEventListener("error", errorHandler);
      worker.postMessage({ type: "runQuality", metric: "trident", msaData, sequenceType });
    });
  }, []);

  const runTcs = useCallback(
    (opts: TcsRunOptions): Promise<{ tcs: number[][]; tcsColMean: number[] }> => {
      return new Promise((resolve, reject) => {
        if (!workerRef.current) {
          reject(new Error("Quality worker not initialized"));
          return;
        }
        const { msaData, sequenceType, onProgress } = opts;
        const worker = workerRef.current;

        const cleanup = () => {
          pendingRejectsRef.current.delete(reject);
          worker.removeEventListener("message", handler);
          worker.removeEventListener("error", errorHandler);
        };
        const handler = (event: MessageEvent<QualityResponseMessage>) => {
          const msg = event.data;
          if (msg.type === "tcsResult") {
            cleanup();
            resolve({ tcs: msg.tcs, tcsColMean: msg.tcsColMean });
          } else if (msg.type === "qualityError" && msg.metric === "tcs") {
            cleanup();
            reject(new Error(msg.error));
          } else if (msg.type === "qualityProgress" && msg.metric === "tcs") {
            onProgress?.(msg.stage, msg.current, msg.total);
          }
        };
        const errorHandler = (event: ErrorEvent) => {
          cleanup();
          reject(new Error(event.message ?? "Quality worker error"));
        };

        pendingRejectsRef.current.add(reject);
        worker.addEventListener("message", handler);
        worker.addEventListener("error", errorHandler);
        worker.postMessage({ type: "runQuality", metric: "tcs", msaData, sequenceType });
      });
    },
    [],
  );

  return { runTrident, runTcs, cancel };
}
