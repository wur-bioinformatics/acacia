import { useCallback, useEffect, useRef } from "react";
import { NJOptions, NJResultMessage } from "./types";
import workerUrl from "./njWorker.ts?worker&url";

export default function useNJWorker() {
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    workerRef.current = new Worker(workerUrl, { type: "module" });
    workerRef.current.onerror = (event) => {
      console.error("NJ worker error:", event.message);
    };
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  const runNJ = useCallback((njOptions: NJOptions): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!workerRef.current) {
        reject(new Error("NJ worker not initialized"));
        return;
      }
      const { onProgress, ...workerOptions } = njOptions;

      const handler = (event: MessageEvent<NJResultMessage>) => {
        const msg = event.data;
        if (msg.type === "njResult") {
          workerRef.current?.removeEventListener("message", handler);
          resolve(msg.result);
        } else if (msg.type === "njError") {
          workerRef.current?.removeEventListener("message", handler);
          reject(new Error(msg.error));
        } else if (msg.type === "njProgress") {
          onProgress?.(msg.current, msg.total);
        }
      };

      workerRef.current.addEventListener("message", handler);
      workerRef.current.postMessage({ type: "runNJ", data: workerOptions });
    });
  }, []);

  return { runNJ };
}
