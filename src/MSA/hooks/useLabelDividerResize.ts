import { useRef, useState } from "react";
import { LABEL_WIDTH } from "../constants";

export default function useLabelDividerResize(): {
  labelWidth: number;
  onMouseDown: (e: React.MouseEvent) => void;
  onTouchStart: (e: React.TouchEvent) => void;
} {
  const [labelWidth, setLabelWidth] = useState(LABEL_WIDTH);
  const dragState = useRef<{ startX: number; startWidth: number } | null>(null);

  function onMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    dragState.current = { startX: e.clientX, startWidth: labelWidth };

    function onMouseMove(ev: MouseEvent) {
      if (!dragState.current) return;
      setLabelWidth(
        Math.max(50, dragState.current.startWidth + ev.clientX - dragState.current.startX),
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
    dragState.current = { startX: e.touches[0].clientX, startWidth: labelWidth };

    function onTouchMove(ev: TouchEvent) {
      if (!dragState.current) return;
      setLabelWidth(
        Math.max(50, dragState.current.startWidth + ev.touches[0].clientX - dragState.current.startX),
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

  return { labelWidth, onMouseDown, onTouchStart };
}
