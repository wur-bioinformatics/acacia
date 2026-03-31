import { useEffect, useRef } from "react";
import { useCanvasStore } from "../stores/canvasStore";

/**
 * Custom React hook that creates and returns refs for a primary canvas and an overlay canvas,
 * and registers those refs with a shared canvas store.
 *
 * When mounted (and whenever `isMinimap` or the store setter functions change), the hook sets
 * the store's canvas/overlay entries to the current DOM elements referenced by the returned refs.
 * On unmount (or when the effect cleans up) it clears the corresponding store entries by setting
 * them to `null`.
 *
 * @param options - Configuration for the hook.
 * @param options.isMinimap - If `true`, the refs are registered with the minimap canvas setters;
 *                            otherwise they are registered with the main canvas setters.
 *
 * @returns An object with two refs:
 *  - `canvasRef`: MutableRefObject<HTMLCanvasElement | null> — ref for the main/minimap canvas element.
 *  - `overlayRef`: MutableRefObject<HTMLCanvasElement | null> — ref for the overlay canvas element.
 *
 * @remarks
 * - The returned refs are initially `null` until attached to DOM elements.
 * - This hook performs side effects (registering/clearing refs in the canvas store) and is intended
 *   for use inside React functional components.
 * - Consumers should ensure the store setters referenced by this hook are stable (e.g. memoized)
 *   to avoid unnecessary effect re-runs.
 */
export default function useCanvasRefs({ isMinimap }: { isMinimap: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);

  const {
    setMainCanvas,
    setMainOverlayCanvas,
    setMinimapCanvas,
    setMinimapOverlayCanvas,
  } = useCanvasStore();

  useEffect(() => {
    if (isMinimap) {
      setMinimapCanvas(canvasRef.current);
      setMinimapOverlayCanvas(overlayRef.current);
    } else {
      setMainCanvas(canvasRef.current);
      setMainOverlayCanvas(overlayRef.current);
    }
    return () => {
      if (isMinimap) {
        setMinimapCanvas(null);
        setMinimapOverlayCanvas(null);
      } else {
        setMainCanvas(null);
        setMainOverlayCanvas(null);
      }
    };
  }, [
    isMinimap,
    setMainCanvas,
    setMainOverlayCanvas,
    setMinimapCanvas,
    setMinimapOverlayCanvas,
  ]);
  return { canvasRef, overlayRef };
}
