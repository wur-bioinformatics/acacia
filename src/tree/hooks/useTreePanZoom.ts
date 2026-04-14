import { useEffect, useRef } from "react";
import { useTreeStore } from "../treeStore";

/**
 * Attaches pan/zoom interactions to an SVG element.
 *
 * - Mouse drag: pan
 * - Mouse wheel: focal-point zoom
 * - Double-click: reset view
 * - Single touch: pan
 * - Two-finger pinch: focal-point zoom
 *
 * Reads/writes pan+zoom state via useTreeStore.getState() in event handlers
 * (not reactive subscriptions) to avoid stale closures.
 *
 * Returns a ref whose `.current` is true while/after a drag, used by click
 * handlers in the tree to distinguish a drag-end from a genuine click.
 */
export default function useTreePanZoom(
  svgRef: React.RefObject<SVGSVGElement | null>,
): React.RefObject<boolean> {
  const isDragging = useRef(false);
  const didDrag = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const pinchStartDist = useRef(0);
  const pinchStartZoom = useRef(1);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const getDistance = (t1: Touch, t2: Touch) =>
      Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);

    const onMouseDown = (e: MouseEvent) => {
      isDragging.current = true;
      didDrag.current = false;
      lastPos.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !lastPos.current) return;
      const dx = e.clientX - lastPos.current.x;
      const dy = e.clientY - lastPos.current.y;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) didDrag.current = true;
      const { panX, panY, zoom } = useTreeStore.getState();
      useTreeStore.getState().setPanAndZoom(panX + dx, panY + dy, zoom);
      lastPos.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      isDragging.current = false;
      lastPos.current = null;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      const focalX = e.clientX - rect.left;
      const focalY = e.clientY - rect.top;
      const { panX, panY, zoom } = useTreeStore.getState();
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      const newZoom = Math.max(0.1, Math.min(10, zoom * factor));
      const ratio = newZoom / zoom;
      useTreeStore.getState().setPanAndZoom(
        focalX - (focalX - panX) * ratio,
        focalY - (focalY - panY) * ratio,
        newZoom,
      );
    };

    const onDblClick = () => {
      useTreeStore.getState().resetView();
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        isDragging.current = true;
        didDrag.current = false;
        lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2) {
        pinchStartDist.current = getDistance(e.touches[0], e.touches[1]);
        pinchStartZoom.current = useTreeStore.getState().zoom;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 1 && lastPos.current) {
        const dx = e.touches[0].clientX - lastPos.current.x;
        const dy = e.touches[0].clientY - lastPos.current.y;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) didDrag.current = true;
        const { panX, panY, zoom } = useTreeStore.getState();
        useTreeStore.getState().setPanAndZoom(panX + dx, panY + dy, zoom);
        lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2 && pinchStartDist.current) {
        const dist = getDistance(e.touches[0], e.touches[1]);
        const rect = svg.getBoundingClientRect();
        const focalX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
        const focalY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
        const { panX, panY, zoom } = useTreeStore.getState();
        const newZoom = Math.max(
          0.1,
          Math.min(10, pinchStartZoom.current * (dist / pinchStartDist.current)),
        );
        const ratio = newZoom / zoom;
        useTreeStore.getState().setPanAndZoom(
          focalX - (focalX - panX) * ratio,
          focalY - (focalY - panY) * ratio,
          newZoom,
        );
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) {
        isDragging.current = false;
        lastPos.current = null;
      } else if (e.touches.length === 1) {
        lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    };

    svg.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    svg.addEventListener("wheel", onWheel, { passive: false });
    svg.addEventListener("dblclick", onDblClick);
    svg.addEventListener("touchstart", onTouchStart, { passive: false });
    svg.addEventListener("touchmove", onTouchMove, { passive: false });
    svg.addEventListener("touchend", onTouchEnd);

    return () => {
      svg.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      svg.removeEventListener("wheel", onWheel);
      svg.removeEventListener("dblclick", onDblClick);
      svg.removeEventListener("touchstart", onTouchStart);
      svg.removeEventListener("touchmove", onTouchMove);
      svg.removeEventListener("touchend", onTouchEnd);
    };
  }, [svgRef]);

  return didDrag;
}
