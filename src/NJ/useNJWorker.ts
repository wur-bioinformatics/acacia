import { useCallback, useEffect, useRef } from "react";
import type { DistanceResult } from "@holmrenser/nj";
import { NJOptions, NJResultMessage } from "./types";
import workerUrl from "./njWorker.ts?worker&url";

type NJRunResult = { newick: string; distanceMatrix: DistanceResult; avgDistance: number };

export default function useNJWorker() {
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    const worker = new Worker(workerUrl, { type: "module" });
    workerRef.current = worker;
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const runNJ = useCallback((njOptions: NJOptions): Promise<NJRunResult> => {
    return new Promise((resolve, reject) => {
      if (!workerRef.current) {
        reject(new Error("NJ worker not initialized"));
        return;
      }
      const { onProgress, ...workerOptions } = njOptions;

      const cleanup = () => {
        workerRef.current?.removeEventListener("message", handler);
        workerRef.current?.removeEventListener("error", errorHandler);
      };

      const handler = (event: MessageEvent<NJResultMessage>) => {
        const msg = event.data;
        if (msg.type === "njResult") {
          cleanup();
          resolve({ newick: msg.newick, distanceMatrix: msg.distanceMatrix, avgDistance: msg.avgDistance });
        } else if (msg.type === "njError") {
          cleanup();
          reject(new Error(msg.error));
        } else if (msg.type === "njProgress") {
          onProgress?.(msg.current, msg.total);
        }
      };

      const errorHandler = (event: ErrorEvent) => {
        cleanup();
        reject(new Error(event.message ?? "Worker error"));
      };
      workerRef.current.addEventListener("message", handler);
      workerRef.current.addEventListener("error", errorHandler);
      workerRef.current.postMessage({ type: "runNJ", data: workerOptions });
    });
  }, []);

  return { runNJ };
}
