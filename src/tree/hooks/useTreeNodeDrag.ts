import { useCallback, useEffect, useRef, useState } from "react";
import type { LayoutNode, NodeId } from "../types";
import { rerootFlat, rotateFlat, rotateFlatToOrder } from "../layout";
import { useTreeStore } from "../treeStore";
import { useSequenceStore } from "../../sequenceStore";
import { collectVisible, planLeafReorder, type DragPlan } from "../utils/drag";
import { MARGIN } from "../constants";

const DRAG_THRESHOLD = 4;

// How far past the outgroup (in rows) the cursor must travel to trigger reroot intent.
// Set to 1 row so the reroot zone is reachable but not accidentally entered.
const REROOT_THRESHOLD_ROWS = 1;

type DragMode = "rotate" | "reroot-above" | "reroot-below";

type DragRef = {
  // Cached at drag-start. The dragged node id is the canonical identity of the moved subtree;
  // rows is cached so collapse-state changes during drag (which would otherwise update
  // visibleRowsRef) cannot cause indices to desync from the captured nodes.
  draggedNodeId: NodeId;
  rows: LayoutNode[];
  startClientY: number;
  moved: boolean;
  // Last committed action shape for use at pointerup. Either an SPR plan or a reroot intent.
  lastValidPlan: DragPlan | null;
  lastMode: DragMode;
  pointerId: number;
};

export type TreeNodeDragHandle = {
  svgRef: (el: SVGSVGElement | null) => void;
  // Convenience accessor for the current SVG element (for export-as-PNG/SVG callers).
  svgElRef: React.RefObject<SVGSVGElement | null>;
  visibleRowsRef: React.RefObject<LayoutNode[]>;
  dropRow: number | null;
  svgDragging: boolean;
  wasDraggingRef: React.RefObject<boolean>;
  // Attach as React onPointerDown on the <svg>. Native addEventListener on the SVG can be
  // shadowed by React's event delegation in some setups; using the synthetic handler matches
  // the rest of the SVG's React event wiring (onClick lives there too).
  onPointerDown: (e: React.PointerEvent<SVGSVGElement>) => void;
};

// Manages SVG-circle drag (rect/cladogram only) and radial pan/wheel.
// pointermove and pointerup are attached to window during the lifetime of the hook so events
// never get lost when the pointer leaves the SVG bounds.
export function useTreeNodeDrag(layoutResult: { root: LayoutNode } | null): TreeNodeDragHandle {
  const svgElRef = useRef<SVGSVGElement | null>(null);
  // Callback ref: fires every time the SVG mounts (becomes non-null) or unmounts (null). Using
  // a callback ref ensures listener attachment runs the moment the SVG appears, not just on
  // hook-mount — Tree returns early until flatTree is loaded, so a useEffect on mount alone
  // would see svgRef.current = null and skip attachment forever.
  const [svgEl, setSvgEl] = useState<SVGSVGElement | null>(null);
  const svgRef = useCallback((el: SVGSVGElement | null) => {
    svgElRef.current = el;
    setSvgEl(el);
  }, []);
  const visibleRowsRef = useRef<LayoutNode[]>([]);
  const wasDraggingRef = useRef(false);
  const dragRef = useRef<DragRef | null>(null);
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const [dropRow, setDropRow] = useState<number | null>(null);
  const [svgDragging, setSvgDragging] = useState(false);

  const collapsedNodes = useTreeStore((s) => s.collapsedNodes);

  // Keep visibleRowsRef in sync — but the active drag uses a frozen snapshot in dragRef.
  useEffect(() => {
    if (layoutResult) visibleRowsRef.current = collectVisible(layoutResult.root, collapsedNodes);
  }, [layoutResult, collapsedNodes]);

  const commit = useCallback(() => {
    const drag = dragRef.current;
    if (!drag) return;
    const state = useTreeStore.getState();
    if (!state.flatTree) return;
    let changed = false;
    if (drag.lastMode === "reroot-above" || drag.lastMode === "reroot-below") {
      // Reroot on the dragged node's branch. For below-outgroup intent, also rotate root so
      // the dragged subtree ends up at the BOTTOM of the rendered order (matching the drop).
      let newTree = rerootFlat(state.flatTree, drag.draggedNodeId);
      if (newTree === state.flatTree) return; // already at root or invalid
      if (drag.lastMode === "reroot-below") {
        newTree = rotateFlat(newTree, newTree.rootId);
      }
      useTreeStore.setState({
        flatTree: newTree,
        previewFlatTree: null,
        selectedNodeId: null,
      });
      changed = true;
    } else if (drag.lastValidPlan) {
      // Rotation only: never alters tree topology, never introduces polytomies. The result
      // may not match the user's drop exactly when the requested order isn't achievable
      // by rotation — that's the trade-off for topology preservation.
      state.rotateLeavesToOrder(drag.lastValidPlan.newLeafOrder);
      changed = true;
    }
    if (changed) {
      const ft = useTreeStore.getState().flatTree!;
      const newLeafNames = ft.leafOrder.map((id) => ft.nodes.get(id)!.name);
      useSequenceStore.getState().syncFromTreeLeafOrder(newLeafNames);
    }
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    const target = e.target as SVGElement;
    const nodeId = target.dataset?.nodeid;
    if (nodeId) {
      const state = useTreeStore.getState();
      if (!state.flatTree || state.layoutMode === "radial" || !state.dragEnabled) return;
      // Snapshot rows at drag-start so subsequent layout changes don't shift indices.
      dragRef.current = {
        draggedNodeId: nodeId as NodeId,
        rows: visibleRowsRef.current.slice(),
        startClientY: e.clientY,
        moved: false,
        lastValidPlan: null,
        lastMode: "rotate",
        pointerId: e.pointerId,
      };
      setSvgDragging(true);
      try {
        target.setPointerCapture(e.pointerId);
      } catch {
        // Some pointer types may not support capture — window listeners catch events anyway.
      }
      return;
    }
    if (useTreeStore.getState().layoutMode !== "radial") return;
    const { radialPan } = useTreeStore.getState();
    panStartRef.current = { x: e.clientX, y: e.clientY, panX: radialPan.x, panY: radialPan.y };
  }, []);

  // Wheel (preventDefault requires non-passive, so attach via native API) + window-level
  // pointer listeners that catch movement after pointerdown regardless of where the pointer
  // travels. Re-runs when the SVG element changes (mount/unmount) so we catch the late mount.
  useEffect(() => {
    if (!svgEl) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { layoutMode, xZoom, radialZoom } = useTreeStore.getState();
      const factor = e.deltaY > 0 ? 0.9 : 1 / 0.9;
      if (layoutMode === "radial") {
        useTreeStore.getState().setRadialZoom(radialZoom * factor);
      } else {
        useTreeStore.getState().setXZoom(xZoom * factor);
      }
    };

    const onWindowPointerMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (drag && e.pointerId === drag.pointerId) {
        if (!drag.moved && Math.abs(e.clientY - drag.startClientY) < DRAG_THRESHOLD) return;
        drag.moved = true;
        const state = useTreeStore.getState();
        if (!state.flatTree) return;
        const rows = drag.rows;
        if (rows.length === 0) return;
        const svgRect = svgEl.getBoundingClientRect();
        const svgY = e.clientY - svgRect.top - MARGIN.top;
        const yStep = state.yStep;
        const aboveOutgroup = svgY < -REROOT_THRESHOLD_ROWS * yStep;
        const belowOutgroup = svgY > (rows.length - 1) * yStep + REROOT_THRESHOLD_ROWS * yStep;

        if (aboveOutgroup || belowOutgroup) {
          // Reroot intent: preview the rerooted tree (rotated for below-outgroup so the
          // dragged clade ends up at the bottom).
          let previewTree = rerootFlat(state.flatTree, drag.draggedNodeId);
          if (previewTree === state.flatTree) return; // dragged node is already root — ignore
          if (belowOutgroup) {
            previewTree = rotateFlat(previewTree, previewTree.rootId);
          }
          drag.lastMode = aboveOutgroup ? "reroot-above" : "reroot-below";
          drag.lastValidPlan = null;
          // Indicator at the very edge — clamp dropRow so the line stays inside the SVG.
          setDropRow(aboveOutgroup ? 0 : rows.length - 1);
          state.setPreviewFlatTree(previewTree);
          return;
        }

        const targetRow = Math.max(0, Math.min(rows.length - 1, Math.round(svgY / yStep)));
        setDropRow(targetRow);
        const plan = planLeafReorder({
          flatTree: state.flatTree,
          visibleRows: rows,
          draggedNodeId: drag.draggedNodeId,
          toRowIndex: targetRow,
        });
        if (plan) {
          // Rotation-only preview. Topology stays intact (no polytomies introduced).
          drag.lastMode = "rotate";
          drag.lastValidPlan = plan;
          state.setPreviewFlatTree(rotateFlatToOrder(state.flatTree, plan.newLeafOrder));
        } else if (drag.lastMode !== "rotate") {
          // Pointer left the reroot zone without a valid rotation plan. Discard the prior
          // reroot intent so pointerup doesn't commit a reroot (which would halve the
          // dragged node's branch length).
          drag.lastMode = "rotate";
          drag.lastValidPlan = null;
          state.setPreviewFlatTree(null);
        }
        return;
      }
      const pan = panStartRef.current;
      if (pan) {
        const dx = e.clientX - pan.x;
        const dy = e.clientY - pan.y;
        useTreeStore.getState().setRadialPan({ x: pan.panX + dx, y: pan.panY + dy });
      }
    };

    const onWindowPointerUp = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (drag && e.pointerId === drag.pointerId) {
        if (drag.moved) {
          wasDraggingRef.current = true;
          commit();
        }
        dragRef.current = null;
        setDropRow(null);
        setSvgDragging(false);
        useTreeStore.getState().setPreviewFlatTree(null);
        return;
      }
      if (panStartRef.current) panStartRef.current = null;
    };

    svgEl.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("pointermove", onWindowPointerMove);
    window.addEventListener("pointerup", onWindowPointerUp);
    window.addEventListener("pointercancel", onWindowPointerUp);
    return () => {
      svgEl.removeEventListener("wheel", onWheel);
      window.removeEventListener("pointermove", onWindowPointerMove);
      window.removeEventListener("pointerup", onWindowPointerUp);
      window.removeEventListener("pointercancel", onWindowPointerUp);
    };
  }, [commit, svgEl]);

  return { svgRef, svgElRef, visibleRowsRef, dropRow, svgDragging, wasDraggingRef, onPointerDown };
}
