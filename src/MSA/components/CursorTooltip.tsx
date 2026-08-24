import { useEffect, useState, type JSX } from "react";
import { useDrawStore } from "../stores/drawStore";
import { CURSOR_RGB, CURSOR_RGB_DARK } from "../constants";
import { formatCursorPosition } from "../utils/cursorPosition";

/** How long the pointer must sit still before the coordinates pop up. */
const DWELL_MS = 350;

const OFFSET_X = 14;
const OFFSET_Y = 18;
/** Rough tooltip footprint, used to flip it away from the viewport edges. */
const EST_WIDTH = 150;
const EST_HEIGHT = 26;

/**
 * Coordinates of the hovered cell, floating next to the cursor once it has been
 * held still. Follows the floating-panel convention: `position: fixed` at the
 * pointer, no DOM anchor, pointer-events off so it never blocks the canvas.
 */
export default function CursorTooltip(): JSX.Element | null {
  const hoverCell = useDrawStore((s) => s.hoverCell);
  const darkMode = useDrawStore((s) => s.drawOptions.darkMode);
  const [settled, setSettled] = useState(false);

  // Every pointer move writes a new hoverCell, which restarts the timer — so it
  // only ever fires while the pointer is stationary.
  useEffect(() => {
    if (!hoverCell) {
      setSettled(false);
      return;
    }
    setSettled(false);
    const timer = setTimeout(() => setSettled(true), DWELL_MS);
    return () => clearTimeout(timer);
  }, [hoverCell]);

  if (!hoverCell || !settled) return null;
  const { row, col } = formatCursorPosition(hoverCell);
  const rgb = darkMode ? CURSOR_RGB_DARK : CURSOR_RGB;

  const flipX = hoverCell.clientX + OFFSET_X + EST_WIDTH > window.innerWidth;
  const flipY = hoverCell.clientY + OFFSET_Y + EST_HEIGHT > window.innerHeight;

  return (
    <div
      className="pointer-events-none fixed z-50 rounded-md border bg-popover px-2 py-1 font-mono text-xs text-popover-foreground shadow-md"
      style={{
        left: hoverCell.clientX + (flipX ? -OFFSET_X - EST_WIDTH : OFFSET_X),
        top: hoverCell.clientY + (flipY ? -OFFSET_Y - EST_HEIGHT : OFFSET_Y),
        borderColor: `rgba(${rgb},0.4)`,
      }}
    >
      <span style={{ color: `rgb(${rgb})` }}>
        {row} · {col}
      </span>
    </div>
  );
}
