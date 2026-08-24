import type { JSX } from "react";
import { useDrawStore } from "../stores/drawStore";
import { CURSOR_RGB, CURSOR_RGB_DARK } from "../constants";
import { formatCursorPosition } from "../utils/cursorPosition";

/**
 * Status-bar readout of the cell under the cursor, in the same blue as the
 * cross-hair on the canvas. Renders nothing when the pointer is off the
 * alignment. The status bar is dimmed as a whole, so this opts back to full
 * opacity to stay legible.
 */
export default function CursorPositionBadge(): JSX.Element | null {
  const hoverCell = useDrawStore((s) => s.hoverCell);
  const darkMode = useDrawStore((s) => s.drawOptions.darkMode);

  if (!hoverCell) return null;
  const { row, col } = formatCursorPosition(hoverCell);
  const rgb = darkMode ? CURSOR_RGB_DARK : CURSOR_RGB;

  return (
    <span
      className="rounded px-1.5 py-0.5 opacity-100"
      style={{
        color: `rgb(${rgb})`,
        backgroundColor: `rgba(${rgb},0.12)`,
        border: `1px solid rgba(${rgb},0.35)`,
      }}
    >
      {row} · {col}
    </span>
  );
}
