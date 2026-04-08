import { useEffect, useRef } from "react";
import { DrawOptions, MSAData } from "../types";

import workerUrl from "../canvasWorker?worker&url";
import type { InitMessage, SetMSAMessage, RedrawMessage } from "../types";

/**
 * Custom React hook that manages a dedicated Web Worker for rendering to a canvas (via OffscreenCanvas).
 *
 * This hook:
 * - Lazily creates and caches a Worker instance.
 * - Transfers the provided HTMLCanvasElement to an OffscreenCanvas and sends it to the worker once.
 * - Sends MSA data updates to the worker whenever `msaData` changes.
 * - Sends redraw requests and draw options to the worker; also installs a basic `onmessage` handler to observe worker messages.
 *
 * The hook performs its work via multiple effects:
 * - An initialization effect that creates the worker (module type) and performs a single `transferControlToOffscreen` on the canvas
 *   (guarded by an internal `hasTransferred` ref so the transfer only occurs once).
 * - An effect that posts MSA data to the worker whenever the `msaData` argument changes.
 * - An effect that posts redraw/draw options and assigns a message listener on the worker. Note: the redraw/message-listener effect
 *   in the implementation runs frequently (no dependency array), so the message handler and redraw message will be re-applied accordingly.
 *
 * Important notes:
 * - The hook expects message types compatible with the worker protocol: `InitMessage` (contains `type: "init"` and an OffscreenCanvas),
 *   `SetMSAMessage` (`type: "setMSA"`, payload `msaData`), and `RedrawMessage` (`type: "redraw"`, with `drawOptions` and `isMinimap`).
 * - The hook transfers canvas ownership to the worker (OffscreenCanvas), so the main thread will no longer be able to draw to that canvas.
 * - The hook does not expose the worker directly or return any value; it manages communication internally via postMessage/onmessage.
 * - Consumers must ensure `canvasRef` is a stable React ref to an HTMLCanvasElement and that the browser supports OffscreenCanvas and module workers.
 *
 * @param params.canvasRef React ref object pointing to the HTMLCanvasElement which will be transferred to an OffscreenCanvas.
 *                        If null or undefined, the initialization transfer is skipped until a non-null element is available.
 * @param params.msaData   The multiple-sequence alignment (MSA) data payload to be sent to the worker. The hook posts this
 *                        payload whenever `msaData` changes.
 * @param params.drawOptions Options that control how the worker should render the canvas. These are sent to the worker as part of
 *                          redraw requests.
 * @param params.isMinimap  Boolean flag passed along with redraw requests indicating whether the worker should render a minimap view.
 *
 * @returns void
 *
 * @example
 * // Usage (conceptual):
 * // const canvasRef = useRef<HTMLCanvasElement | null>(null);
 * // useMainCanvasWorker({ canvasRef, msaData, drawOptions, isMinimap });
 *
 * @see InitMessage, SetMSAMessage, RedrawMessage — expected worker message shapes used by this hook.
 */
export default function useMainCanvasWorker({
  canvasRef,
  msaData,
  drawOptions,
  isMinimap,
  canvasWidth,
  canvasHeight,
}: {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  msaData: MSAData;
  drawOptions: DrawOptions;
  isMinimap: boolean;
  canvasWidth: number;
  canvasHeight: number;
}) {
  const workerRef = useRef<Worker | null>(null);
  const hasTransferred = useRef(false);

  useEffect(() => {
    // Effect to initialize worker and transfer OffscreenCanvas
    if (!canvasRef) return;
    if (!workerRef.current) {
      workerRef.current = new Worker(workerUrl, { type: "module" });
      workerRef.current.onmessage = (ev: MessageEvent) => {
        console.log(ev.data);
      };
    }

    if (!hasTransferred.current && canvasRef.current) {
      const offscreen = canvasRef.current.transferControlToOffscreen();
      const message: InitMessage = {
        type: "init",
        canvas: offscreen,
      };
      workerRef.current.postMessage(message, [offscreen]);
      hasTransferred.current = true;
    }
  }, [canvasRef]);

  useEffect(() => {
    // Effect to send MSA data to worker
    if (!workerRef.current) return;
    const message: SetMSAMessage = {
      type: "setMSA",
      msaData,
    };
    workerRef.current.postMessage(message);
  }, [msaData]);

  useEffect(() => {
    // Effect to send draw options to worker
    if (!workerRef.current) return;
    const message: RedrawMessage = {
      type: "redraw",
      drawOptions,
      isMinimap,
      canvasWidth,
      canvasHeight,
    };
    workerRef.current.postMessage(message);
  }, [drawOptions, isMinimap, canvasWidth, canvasHeight]);
}
