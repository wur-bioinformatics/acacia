import { useEffect, useRef, useState } from "react";
import { MSAData } from "../types";

import workerUrl from "../canvasWorker?worker&url";
import type { InitMessage, SetMSAMessage, RedrawMessage, DragPreviewMessage } from "../types";
import { useDrawStore } from "../stores/drawStore";

export default function useMainCanvasWorker({
  canvasRef,
  msaData,
  isMinimap,
  canvasWidth,
  canvasHeight,
}: {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  msaData: MSAData;
  isMinimap: boolean;
  canvasWidth: number;
  canvasHeight: number;
}) {
  const workerRef = useRef<Worker | null>(null);
  const hasTransferred = useRef(false);
  const isWorkerBusy = useRef(false);
  const pendingMessage = useRef<RedrawMessage | null>(null);
  const [isRendering, setIsRendering] = useState(false);

  // Refs so the Zustand subscription always sends current dimensions/mode
  // without needing to re-subscribe when they change.
  const isMinimap_ref = useRef(isMinimap);
  isMinimap_ref.current = isMinimap;
  const canvasWidth_ref = useRef(canvasWidth);
  canvasWidth_ref.current = canvasWidth;
  const canvasHeight_ref = useRef(canvasHeight);
  canvasHeight_ref.current = canvasHeight;

  useEffect(() => {
    // Initialize worker and transfer OffscreenCanvas
    if (!canvasRef) return;
    if (!workerRef.current) {
      workerRef.current = new Worker(workerUrl, { type: "module" });
      // When the worker finishes a render it posts "done". If a newer message
      // was queued while it was busy, send that immediately; otherwise mark idle.
      workerRef.current.onmessage = (e: MessageEvent<{ type: string }>) => {
        if (e.data.type !== "done") return;
        if (pendingMessage.current) {
          const msg = pendingMessage.current;
          pendingMessage.current = null;
          workerRef.current!.postMessage(msg);
          // isWorkerBusy and isRendering stay true
        } else {
          isWorkerBusy.current = false;
          setIsRendering(false);
        }
      };
    }

    if (!hasTransferred.current && canvasRef.current) {
      const offscreen = canvasRef.current.transferControlToOffscreen();
      const message: InitMessage = { type: "init", canvas: offscreen };
      workerRef.current.postMessage(message, [offscreen]);
      hasTransferred.current = true;
    }
  }, [canvasRef]);

  useEffect(() => {
    // Send MSA data to worker when it changes
    if (!workerRef.current) return;
    const message: SetMSAMessage = { type: "setMSA", msaData };
    workerRef.current.postMessage(message);
  }, [msaData]);

  useEffect(() => {
    // Subscribe to drawOptions changes directly from Zustand, bypassing the React
    // render cycle. Fires synchronously when setDrawOptions is called (e.g. on every
    // wheel event), with no frame-boundary delay.
    //
    // Latest-only dispatch: if the worker is already rendering, the new message
    // overwrites the pending slot instead of queuing. The worker drains the pending
    // slot in its "done" handler above, so the queue depth is always ≤ 1.
    let prevDrawOptions = useDrawStore.getState().drawOptions;
    return useDrawStore.subscribe((state) => {
      if (state.drawOptions === prevDrawOptions) return;
      prevDrawOptions = state.drawOptions;
      if (!workerRef.current) return;
      const message: RedrawMessage = {
        type: "redraw",
        drawOptions: state.drawOptions,
        isMinimap: isMinimap_ref.current,
        canvasWidth: canvasWidth_ref.current,
        canvasHeight: canvasHeight_ref.current,
      };
      if (isWorkerBusy.current) {
        pendingMessage.current = message;
      } else {
        isWorkerBusy.current = true;
        setIsRendering(true);
        workerRef.current.postMessage(message);
      }
    });
  }, []);

  useEffect(() => {
    // Trigger a redraw when canvas dimensions or minimap flag change (e.g. window resize).
    if (!workerRef.current) return;
    const message: RedrawMessage = {
      type: "redraw",
      drawOptions: useDrawStore.getState().drawOptions,
      isMinimap,
      canvasWidth,
      canvasHeight,
    };
    if (isWorkerBusy.current) {
      pendingMessage.current = message;
    } else {
      isWorkerBusy.current = true;
      setIsRendering(true);
      workerRef.current.postMessage(message);
    }
  }, [canvasWidth, canvasHeight, isMinimap]);

  useEffect(() => {
    // Subscribe to dragState changes outside React render cycles so the
    // worker receives preview messages on every row-boundary crossing.
    let prev = useDrawStore.getState().dragState;
    const unsubscribe = useDrawStore.subscribe((state) => {
      if (state.dragState === prev) return;
      prev = state.dragState;
      if (!workerRef.current) return;
      const message: DragPreviewMessage = {
        type: "dragPreview",
        dragIndex: state.dragState?.dragIndex ?? null,
        hoverIndex: state.dragState?.hoverIndex ?? null,
      };
      workerRef.current.postMessage(message);
    });
    return unsubscribe;
  }, []);

  return { isRendering };
}
