import { useCallback, useEffect, useRef } from "react";
import workerUrl from "../workers/qualityWorker.ts?worker&url";
import type {
  MSAData,
  QualityResponseMessage,
  QualityStage,
  SequenceType,
} from "../types";

export type QualityRunOptions = {
  msaData: MSAData;
  sequenceType: SequenceType;
  onProgress?: (stage: QualityStage, current: number, total: number) => void;
};

export type QualityRunResult = {
  trident: number[];
  tcs: number[][];
  tcsColMean: number[];
};

export default function useQualityWorker() {
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    const worker = new Worker(workerUrl, { type: "module" });
    workerRef.current = worker;
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const runQuality = useCallback(
    (opts: QualityRunOptions): Promise<QualityRunResult> => {
      return new Promise((resolve, reject) => {
        if (!workerRef.current) {
          reject(new Error("Quality worker not initialized"));
          return;
        }
        const { onProgress, msaData, sequenceType } = opts;

        const cleanup = () => {
          workerRef.current?.removeEventListener("message", handler);
          workerRef.current?.removeEventListener("error", errorHandler);
        };

        const handler = (event: MessageEvent<QualityResponseMessage>) => {
          const msg = event.data;
          if (msg.type === "qualityResult") {
            cleanup();
            resolve({ trident: msg.trident, tcs: msg.tcs, tcsColMean: msg.tcsColMean });
          } else if (msg.type === "qualityError") {
            cleanup();
            reject(new Error(msg.error));
          } else if (msg.type === "qualityProgress") {
            onProgress?.(msg.stage, msg.current, msg.total);
          }
        };

        const errorHandler = (event: ErrorEvent) => {
          cleanup();
          reject(new Error(event.message ?? "Quality worker error"));
        };

        workerRef.current.addEventListener("message", handler);
        workerRef.current.addEventListener("error", errorHandler);
        workerRef.current.postMessage({ type: "runQuality", msaData, sequenceType });
      });
    },
    [],
  );

  return { runQuality };
}
