import { useEffect, useRef } from "react";
import { useCanvasContext } from "../context/CanvasContext";
import { useDrawStore } from "../stores/drawStore";
import { CELL_SIZE } from "../constants";
import type { MSAData } from "../types";
import {
  applySelectionMode,
  intRangeSet,
  pixelRectToColRange,
  pixelRectToRowRange,
  type SelectionMode,
} from "../utils/selectionMath";

const CLICK_THRESHOLD_PX = 3;

function modeFor(e: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean }): SelectionMode {
  if (e.shiftKey) return "additive";
  if (e.metaKey || e.ctrlKey) return "toggle";
  return "replace";
}

function hasModifier(e: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean }): boolean {
  return e.shiftKey || e.metaKey || e.ctrlKey;
}

export default function useSelectionInteractions({
  orderedMsaData,
  nCols,
}: {
  orderedMsaData: MSAData;
  nCols: number;
}) {
  const { mainOverlayCanvas: canvas } = useCanvasContext();
  const orderedRef = useRef(orderedMsaData);
  orderedRef.current = orderedMsaData;
  const nColsRef = useRef(nCols);
  nColsRef.current = nCols;

  useEffect(() => {
    if (!canvas) return;

    type DragState = {
      startX: number;
      startY: number;
      mode: SelectionMode;
    };
    let drag: DragState | null = null;

    function getCanvasXY(clientX: number, clientY: number) {
      const rect = canvas!.getBoundingClientRect();
      return { x: clientX - rect.left, y: clientY - rect.top };
    }

    const onMouseDown = (e: MouseEvent) => {
      const modifier = hasModifier(e);
      // In pan mode, only a modifier-held drag selects. In select mode, a plain
      // drag selects (replace), while modifiers still mean additive/toggle.
      if (useDrawStore.getState().interactionMode !== "select" && !modifier) return;
      // Prevent usePanZoom (also listening on mousedown) from starting a pan.
      e.stopPropagation();
      e.preventDefault();
      const { x, y } = getCanvasXY(e.clientX, e.clientY);
      const mode = modifier ? modeFor(e) : "replace";
      drag = { startX: x, startY: y, mode };
      useDrawStore.getState().setDragRect({ startX: x, startY: y, curX: x, curY: y, mode });
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!drag) return;
      const { x, y } = getCanvasXY(e.clientX, e.clientY);
      useDrawStore
        .getState()
        .setDragRect({ startX: drag.startX, startY: drag.startY, curX: x, curY: y, mode: drag.mode });
    };

    const onMouseUp = (e: MouseEvent) => {
      if (!drag) return;
      const { x, y } = getCanvasXY(e.clientX, e.clientY);
      const { startX, startY, mode } = drag;
      drag = null;
      useDrawStore.getState().setDragRect(null);

      const dx = x - startX;
      const dy = y - startY;
      const isClick = Math.hypot(dx, dy) < CLICK_THRESHOLD_PX;

      const { offsetX, offsetY, scale, showConsensus } = useDrawStore.getState().drawOptions;
      const ordered = orderedRef.current;
      const nRows = ordered.length;
      const nC = nColsRef.current;

      if (isClick) {
        const colRange = pixelRectToColRange(x, x, offsetX, scale, CELL_SIZE, nC);
        const rowRange = pixelRectToRowRange(y, y, offsetY, CELL_SIZE, nRows, showConsensus);
        if (!colRange || !rowRange) return;
        applyClick(mode, e.shiftKey, colRange.colMin, rowRange.rowMin);
      } else {
        const colRange = pixelRectToColRange(startX, x, offsetX, scale, CELL_SIZE, nC);
        const rowRange = pixelRectToRowRange(startY, y, offsetY, CELL_SIZE, nRows, showConsensus);
        applyDragRect(mode, colRange, rowRange);
      }
    };

    function applyClick(mode: SelectionMode, isShift: boolean, col: number, row: number) {
      const { selection } = useDrawStore.getState();
      const ordered = orderedRef.current;
      const id = ordered[row]?.identifier;
      if (id === undefined) return;

      // Shift-click extends from anchor; Cmd/Ctrl toggles; plain (no modifier) — won't reach here
      // because mousedown only runs when a modifier was held.
      const rowRange =
        isShift && selection.lastRow
          ? rowRangeBetween(ordered, selection.lastRow, id)
          : [id];
      const colRange =
        isShift && selection.lastCol !== null
          ? intRangeSet(Math.min(selection.lastCol, col), Math.max(selection.lastCol, col))
          : new Set([col]);

      const axis = useDrawStore.getState().selectionAxis;
      useDrawStore.getState().setSelection((prev) => ({
        rows: axis === "rows" ? applySelectionMode(prev.rows, rowRange, mode) : prev.rows,
        columns: axis === "columns" ? applySelectionMode(prev.columns, colRange, mode) : prev.columns,
        lastRow: axis === "rows" ? id : prev.lastRow,
        lastCol: axis === "columns" ? col : prev.lastCol,
      }));
    }

    function applyDragRect(
      mode: SelectionMode,
      colRange: { colMin: number; colMax: number } | null,
      rowRange: { rowMin: number; rowMax: number } | null,
    ) {
      if (!colRange || !rowRange) return;
      const ordered = orderedRef.current;
      const ids: string[] = [];
      for (let r = rowRange.rowMin; r <= rowRange.rowMax; r++) {
        const id = ordered[r]?.identifier;
        if (id !== undefined) ids.push(id);
      }
      const cols = intRangeSet(colRange.colMin, colRange.colMax);
      const axis = useDrawStore.getState().selectionAxis;
      useDrawStore.getState().setSelection((prev) => ({
        rows: axis === "rows" ? applySelectionMode(prev.rows, ids, mode) : prev.rows,
        columns: axis === "columns" ? applySelectionMode(prev.columns, cols, mode) : prev.columns,
        lastRow: axis === "rows" ? (ids[ids.length - 1] ?? prev.lastRow) : prev.lastRow,
        lastCol: axis === "columns" ? colRange.colMax : prev.lastCol,
      }));
    }

    function rowRangeBetween(ordered: MSAData, fromId: string, toId: string): string[] {
      const fromIdx = ordered.findIndex((s) => s.identifier === fromId);
      const toIdx = ordered.findIndex((s) => s.identifier === toId);
      if (fromIdx < 0 || toIdx < 0) return [toId];
      const lo = Math.min(fromIdx, toIdx);
      const hi = Math.max(fromIdx, toIdx);
      return ordered.slice(lo, hi + 1).map((s) => s.identifier);
    }

    canvas.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      canvas.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [canvas]);
}
