import { useEffect, useRef } from "react";
import { useCanvasContext } from "../context/CanvasContext";

export default function useCanvasRefs({ isMinimap }: { isMinimap: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);

  const {
    setMainCanvas,
    setMainOverlayCanvas,
    setMinimapCanvas,
    setMinimapOverlayCanvas,
  } = useCanvasContext();

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
