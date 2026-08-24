import type { HoverCell } from "../stores/drawStore";

/**
 * Human-readable coordinates for a hovered cell. Rows and columns are stored
 * 0-based but shown 1-based, matching the scalebar and how alignment positions
 * are usually cited.
 */
export function formatCursorPosition(cell: HoverCell): {
  row: string;
  col: string;
} {
  return {
    row: cell.row === null ? "consensus" : `row ${cell.row + 1}`,
    col: `col ${cell.col + 1}`,
  };
}
