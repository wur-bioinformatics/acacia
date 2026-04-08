import { useEffect, useRef } from "react";
import { useDrawStore } from "../stores/drawStore";
import { CELL_SIZE, MINIMAP_EDGE_ZONE } from "../constants";

type Params = {
  isMinimap: boolean;
  overlayRef: React.RefObject<HTMLCanvasElement | null>;
  width: number;
  height: number;
  nCols: number;
};

export default function useOverlay({
  isMinimap,
  overlayRef,
  width,
  height,
  nCols,
}: Params) {
  const { drawOptions, setDrawOptions } = useDrawStore();
  const { offsetX, offsetY, scale } = drawOptions;

  // Keep a ref so minimap drag handlers always see latest values
  const drawOptionsRef = useRef(drawOptions);
  drawOptionsRef.current = drawOptions;

  // Main canvas: column/row highlight on mousemove
  useEffect(() => {
    const overlayCanvas = overlayRef.current;
    if (!overlayCanvas || isMinimap) return;
    const ctx = overlayCanvas.getContext("2d");
    if (!ctx) return;

    const handleMouseMove = (e: MouseEvent) => {
      const x = e.offsetX;
      const y = e.offsetY;
      const col = Math.floor((x - offsetX) / (CELL_SIZE * scale));
      const row = Math.floor((y - offsetY) / CELL_SIZE);

      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.strokeStyle = "rgba(48,92,222,0.6)";
      ctx.lineWidth = 1;
      ctx.fillStyle = "rgba(48,92,222,0.3)";
      ctx.strokeRect(0, row * CELL_SIZE + offsetY, width, CELL_SIZE);
      ctx.fillRect(0, row * CELL_SIZE + offsetY, width, CELL_SIZE);
      ctx.fillRect(col * CELL_SIZE * scale + offsetX, 0, CELL_SIZE * scale, height);
      ctx.strokeRect(col * CELL_SIZE * scale + offsetX, 0, CELL_SIZE * scale, height);
    };

    overlayCanvas.addEventListener("mousemove", handleMouseMove);
    return () => overlayCanvas.removeEventListener("mousemove", handleMouseMove);
  }, [scale, offsetX, offsetY, isMinimap, overlayRef, height, width]);

  // Minimap: viewport box drawing (runs every render when isMinimap)
  useEffect(() => {
    const overlayCanvas = overlayRef.current;
    if (!overlayCanvas || !isMinimap) return;
    const ctx = overlayCanvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    const scaleX = ctx.canvas.width / (nCols * CELL_SIZE);
    const invScale = 1 / scale;
    const boxX = -offsetX * invScale;
    const boxY = -offsetY;
    const boxW = ctx.canvas.width * invScale;
    const boxH = ctx.canvas.height;

    ctx.save();
    ctx.scale(scaleX, 1);
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = "grey";
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = "darkblue";
    ctx.lineWidth = 6;
    ctx.strokeRect(boxX, boxY, boxW, boxH);
    ctx.restore();
  });

  // Minimap: pan/resize drag interactions
  useEffect(() => {
    if (!isMinimap) return;
    const overlayCanvas = overlayRef.current;
    if (!overlayCanvas) return;

    const W = width;
    const scaleX = W / (nCols * CELL_SIZE);
    const EDGE = MINIMAP_EDGE_ZONE;

    const getBox = () => {
      const { offsetX, scale } = drawOptionsRef.current;
      const boxLeft = (-offsetX / scale) * scaleX;
      const boxW = (W / scale) * scaleX;
      return { boxLeft, boxW, boxRight: boxLeft + boxW };
    };

    const clampScale = (s: number) => Math.max(scaleX, Math.min(1, s));
    const clampOffsetX = (ox: number, s: number) => {
      const minOX = Math.min(0, W - nCols * CELL_SIZE * s);
      return Math.min(0, Math.max(minOX, ox));
    };

    type DragState = {
      mode: "pan" | "resize-left" | "resize-right";
      startClientX: number;
      startOffsetX: number;
      startScale: number;
      startBoxLeft: number;
      startBoxW: number;
    };
    let drag: DragState | null = null;

    const onMouseDown = (e: MouseEvent) => {
      const mx = e.offsetX;
      const { boxLeft, boxW, boxRight } = getBox();
      if (mx < boxLeft - EDGE || mx > boxRight + EDGE) return;
      const { offsetX, scale } = drawOptionsRef.current;
      let mode: DragState["mode"];
      if (Math.abs(mx - boxLeft) <= EDGE) mode = "resize-left";
      else if (Math.abs(mx - boxRight) <= EDGE) mode = "resize-right";
      else mode = "pan";
      drag = { mode, startClientX: e.clientX, startOffsetX: offsetX, startScale: scale, startBoxLeft: boxLeft, startBoxW: boxW };
    };

    const onCanvasMouseMove = (e: MouseEvent) => {
      if (drag) return;
      const mx = e.offsetX;
      const { boxLeft, boxRight } = getBox();
      if (Math.abs(mx - boxLeft) <= EDGE || Math.abs(mx - boxRight) <= EDGE) {
        overlayCanvas.style.cursor = "ew-resize";
      } else if (mx >= boxLeft && mx <= boxRight) {
        overlayCanvas.style.cursor = "grab";
      } else {
        overlayCanvas.style.cursor = "default";
      }
    };

    const onWindowMouseMove = (e: MouseEvent) => {
      if (!drag) return;
      const delta = e.clientX - drag.startClientX;
      if (drag.mode === "pan") {
        const newOffsetX = clampOffsetX(
          drag.startOffsetX - (delta * drag.startScale) / scaleX,
          drag.startScale,
        );
        setDrawOptions((prev) => ({ ...prev, offsetX: newOffsetX }));
      } else if (drag.mode === "resize-right") {
        const newBoxW = Math.max(1, drag.startBoxW + delta);
        const newScale = clampScale((W * scaleX) / newBoxW);
        const viewStart = -drag.startOffsetX / drag.startScale;
        const newOffsetX = clampOffsetX(-viewStart * newScale, newScale);
        setDrawOptions((prev) => ({ ...prev, scale: newScale, offsetX: newOffsetX }));
      } else {
        const newBoxW = Math.max(1, drag.startBoxW - delta);
        const newScale = clampScale((W * scaleX) / newBoxW);
        const viewEnd = (W - drag.startOffsetX) / drag.startScale;
        const newOffsetX = clampOffsetX(W - viewEnd * newScale, newScale);
        setDrawOptions((prev) => ({ ...prev, scale: newScale, offsetX: newOffsetX }));
      }
    };

    const onMouseUp = () => { drag = null; };

    overlayCanvas.addEventListener("mousedown", onMouseDown);
    overlayCanvas.addEventListener("mousemove", onCanvasMouseMove);
    window.addEventListener("mousemove", onWindowMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      overlayCanvas.removeEventListener("mousedown", onMouseDown);
      overlayCanvas.removeEventListener("mousemove", onCanvasMouseMove);
      window.removeEventListener("mousemove", onWindowMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [isMinimap, overlayRef, nCols, setDrawOptions, width]);
}
