import { useCallback, useEffect, useRef } from "react";
import { useCanvasStore } from "../stores/canvasStore";
import { useDrawStore } from "../stores/drawStore";

/**
 * Custom React hook that adds pan and zoom interaction to the main overlay canvas.
 *
 * Behavior
 * - Enables dragging to pan the visible content (mouse and single-touch).
 * - Enables pinch gestures to zoom (two-touch).
 * - Enables mouse wheel zooming with the wheel focal point preserved.
 * - Updates draw options (scale, offsetX, offsetY) through setDrawOptions from the drawing store.
 * - Clamps zoom and pan so content cannot be zoomed or panned outside reasonable bounds.
 * - Prevents default scrolling for wheel and touch-move interactions on the canvas to provide
 *   a native-feeling pan/zoom experience.
 * - Attaches DOM event listeners while the canvas exists and cleans them up on unmount or canvas change.
 *
 * Zoom / clamp details
 * - Scale is clamped to the interval [maxScale, 1], where maxScale is computed from the canvas width
 *   and number of columns to avoid zooming in beyond a practical per-column pixel size (computed to
 *   keep a minimum readable pixel size per column).
 * - Pan is clamped so the rendered content (nCols * cellSize * scale by nRows * cellSize * scale)
 *   cannot be panned completely out of the canvas; offsets are constrained to keep some portion of the
 *   content visible.
 *
 * Implementation notes
 * - Uses refs (isDragging, lastPos, pinchStartDist, pinchStartScale) to track pointer state between events.
 * - Wheel and touchmove listeners are registered with passive: false to allow calling preventDefault().
 * - Mouse move/up listeners are attached to window to ensure drag completes if the pointer leaves the canvas.
 * - All updates to scale and offsets are applied via setDrawOptions, using previous state and clamping utilities
 *   so multiple input modalities compose correctly.
 *
 * Parameters
 * @param params.nRows - Number of rows in the content. Used to compute pan clamping vertical bounds.
 * @param params.nCols - Number of columns in the content. Used to compute pan clamping horizontal bounds
 *                       and to derive a maximum sensible zoom level.
 *
 * Returns
 * - void. This hook manages side effects (event listeners and store updates) and does not return values.
 *
 * Example
 * // Hook is intended to be invoked from within a React component that provides the canvas and draw store:
 * // usePanZoom({ nRows: rowsCount, nCols: colsCount });
 */
export default function usePanZoom({
  nRows,
  nCols,
}: {
  nRows: number;
  nCols: number;
}) {
  const {
    drawOptions: { scale, cellSize },
    setDrawOptions,
  } = useDrawStore();
  const { mainOverlayCanvas: canvas } = useCanvasStore();
  const isDragging = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const pinchStartDist = useRef(0);
  const pinchStartScale = useRef(scale);

  const clampScale = useCallback(
    (newScale: number): number => {
      const maxScale = (canvas?.width || 1) / nCols / 16;
      return Math.max(maxScale, Math.min(newScale, 1));
    },
    [canvas, nCols]
  );

  const clampPan = useCallback(
    (
      offsetX: number,
      offsetY: number,
      scale: number,
      canvas: HTMLCanvasElement
    ) => {
      const contentWidth = nCols * cellSize * scale;
      const contentHeight = nRows * cellSize * scale;
      const minOffsetX = Math.min(0, canvas.width - contentWidth);
      const minOffsetY = Math.min(0, canvas.height - contentHeight);

      return {
        offsetX: Math.min(0, Math.max(minOffsetX, offsetX)),
        offsetY: Math.min(0, Math.max(minOffsetY, offsetY)),
      };
    },
    [nCols, nRows, cellSize]
  );

  const panBy = useCallback(
    (dx: number, dy: number) => {
      if (!canvas) return;

      setDrawOptions((prev) => {
        const clamped = clampPan(
          prev.offsetX + dx,
          prev.offsetY + dy,
          prev.scale,
          canvas
        );
        return { ...prev, ...clamped };
      });
    },
    [canvas, clampPan, setDrawOptions]
  );

  useEffect(() => {
    // Effect to add or remove event listeners
    if (!canvas) return;

    const getDistance = (t1: Touch, t2: Touch) =>
      Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);

    const onMouseDown = (e: MouseEvent) => {
      isDragging.current = true;
      lastPos.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !lastPos.current) return;
      const dx = e.clientX - lastPos.current.x;
      const dy = e.clientY - lastPos.current.y;
      panBy(dx, dy);
      lastPos.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      isDragging.current = false;
      lastPos.current = null;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const focalX = e.clientX - rect.left;

      setDrawOptions((prev) => {
        const factor = e.deltaY < 0 ? 1.1 : 0.9;
        const unclampedScale = prev.scale * factor;
        const nextScale = clampScale(unclampedScale);
        const ratio = nextScale / prev.scale || 1;

        let nextOffsetX = focalX - (focalX - prev.offsetX) * ratio;
        let nextOffsetY = prev.offsetY;

        const clamped = clampPan(nextOffsetX, nextOffsetY, nextScale, canvas);
        nextOffsetX = clamped.offsetX;
        nextOffsetY = clamped.offsetY;

        return {
          ...prev,
          scale: nextScale,
          offsetX: nextOffsetX,
          offsetY: nextOffsetY,
        };
      });
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2) {
        pinchStartDist.current = getDistance(e.touches[0], e.touches[1]);
        pinchStartScale.current = scale;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (!canvas) return;

      if (e.touches.length === 1 && lastPos.current) {
        const dx = e.touches[0].clientX - lastPos.current.x;
        const dy = e.touches[0].clientY - lastPos.current.y;
        panBy(dx, dy);
        lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2 && pinchStartDist.current) {
        const dist = getDistance(e.touches[0], e.touches[1]);
        const scaleRatio = dist / pinchStartDist.current;
        const rect = canvas.getBoundingClientRect();
        const focalX =
          (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;

        setDrawOptions((prev) => {
          const nextScale = clampScale(pinchStartScale.current * scaleRatio);
          const ratio = nextScale / prev.scale || 1;

          let nextOffsetX = focalX - (focalX - prev.offsetX) * ratio;
          let nextOffsetY = prev.offsetY;

          const clamped = clampPan(nextOffsetX, nextOffsetY, nextScale, canvas);
          nextOffsetX = clamped.offsetX;
          nextOffsetY = clamped.offsetY;

          return {
            ...prev,
            scale: nextScale,
            offsetX: nextOffsetX,
            offsetY: nextOffsetY,
          };
        });
      }
    };

    const onTouchEnd = () => {
      lastPos.current = null;
    };

    // Attach listeners
    canvas.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd);

    return () => {
      canvas.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
    };
  }, [canvas, scale, setDrawOptions, panBy, clampScale, clampPan]);
}
