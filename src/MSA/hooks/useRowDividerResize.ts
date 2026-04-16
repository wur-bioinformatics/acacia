import { useRef, useState } from "react";

export default function useRowDividerResize(
  initialHeight: number,
  min: number,
): {
  height: number;
  onMouseDown: (e: React.MouseEvent) => void;
  onTouchStart: (e: React.TouchEvent) => void;
} {
  const [height, setHeight] = useState(initialHeight);
  const dragState = useRef<{ startY: number; startHeight: number } | null>(null);

  function onMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    dragState.current = { startY: e.clientY, startHeight: height };

    function onMouseMove(ev: MouseEvent) {
      if (!dragState.current) return;
      setHeight(
        Math.max(min, dragState.current.startHeight + ev.clientY - dragState.current.startY),
      );
    }

    function onMouseUp() {
      dragState.current = null;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    }

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }

  function onTouchStart(e: React.TouchEvent) {
    e.preventDefault();
    dragState.current = { startY: e.touches[0].clientY, startHeight: height };

    function onTouchMove(ev: TouchEvent) {
      if (!dragState.current) return;
      setHeight(
        Math.max(min, dragState.current.startHeight + ev.touches[0].clientY - dragState.current.startY),
      );
    }

    function onTouchEnd() {
      dragState.current = null;
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    }

    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd);
  }

  return { height, onMouseDown, onTouchStart };
}
