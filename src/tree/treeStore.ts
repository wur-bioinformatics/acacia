import { create } from "zustand";
import type { BranchStyle, FlatTree, LayoutMode, NodeId, NodeStyle } from "./types";
import { collapsePolytomiesByBootstrap, ladderize, rerootFlat, rotateFlat, rotateFlatToOrder } from "./layout";
import { midpointRoot } from "./utils/midpoint";
import { useSequenceStore } from "../sequenceStore";

// Returns the set of valid (still-internal, still-existing) collapsed IDs after a tree mutation.
// Required because reroot/midpoint may turn a previously-internal node into a leaf — keeping
// such IDs collapsed renders incorrectly.
function pruneCollapsed(
  current: ReadonlySet<NodeId>,
  newTree: FlatTree,
): Set<NodeId> {
  return new Set(
    [...current].filter((id) => {
      const node = newTree.nodes.get(id);
      return node !== undefined && node.childIds.length > 0;
    }),
  );
}

// Drops style/branch-style entries keyed by internal node IDs that no longer
// exist in `newTree`. Leaf-keyed entries ("leaf:<name>", "branch:leaf:<name>")
// are preserved — leaves are never removed by polytomy collapse.
function pruneStylesForRemovedNodes<T>(
  current: ReadonlyMap<string, T>,
  newTree: FlatTree,
): Map<string, T> {
  const next = new Map(current);
  for (const key of current.keys()) {
    if (key.startsWith("leaf:") || key.startsWith("branch:leaf:")) continue;
    const nodeId = key.startsWith("branch:") ? key.slice("branch:".length) : key;
    if (!newTree.nodes.has(nodeId)) next.delete(key);
  }
  return next;
}

const VIEW_STATE_RESET = {
  collapsedNodes: new Set<NodeId>(),
  nodeStyles: new Map<string, NodeStyle>(),
  branchStyles: new Map<string, BranchStyle>(),
  selectedNodeId: null,
};

// Node style keys:
//   - Leaf nodes:     "leaf:<sequenceName>"   (stable across reroots)
//   - Internal nodes: "<nodeId>"              (e.g. "n5"; stable across reroots)
// Branch style keys:
//   - Leaf branches:     "branch:leaf:<sequenceName>"
//   - Internal branches: "branch:<nodeId>"
//
// Because all IDs are stable, styles and collapsed state are NEVER cleared on
// reroot or rotate. Only setFlatTree (new tree loaded) and resetRoot clear them.

// Snapshot of the initially-loaded tree — stored outside Zustand state for O(1) reset.
let _originalFlatTree: FlatTree | null = null;

type TreeState = {
  layoutMode: LayoutMode;
  yStep: number;
  // Horizontal zoom multiplier for rect/cladogram (applied on top of xScale).
  xZoom: number;
  // Pan/zoom transform for radial mode.
  radialPan: { x: number; y: number };
  radialZoom: number;
  flatTree: FlatTree | null;
  // Ephemeral tree used during label drag — rendered instead of flatTree, never committed.
  // Set on each hover-index change during drag; cleared on drop or cancel.
  previewFlatTree: FlatTree | null;
  // Single-step undo for bootstrap polytomy collapse. Holds the tree as it was
  // immediately before the most recent collapseBelowBootstrap call; null when
  // no collapse has been performed (or after revertBootstrapCollapse / a new
  // tree load / resetRoot).
  preCollapseFlatTree: FlatTree | null;
  collapsedNodes: ReadonlySet<NodeId>;
  nodeStyles: ReadonlyMap<string, NodeStyle>;
  // Keys: "branch:leaf:<leafName>" (stable) or "branch:<nodeId>"
  branchStyles: ReadonlyMap<string, BranchStyle>;
  selectedNodeId: NodeId | null;
  showBootstrap: boolean;
  // Hide bootstrap labels with value below this threshold (0 = show all).
  bootstrapThreshold: number;
  searchQuery: string;
  searchUseRegex: boolean;
  dragEnabled: boolean;
  // Style sliders.
  branchWidth: number;
  labelFontSize: number;
  nodeRadius: number;
  showBranchLengths: boolean;
  showScaleBar: boolean;

  setLayoutMode: (mode: LayoutMode) => void;
  setYStep: (yStep: number) => void;
  setXZoom: (xZoom: number) => void;
  setRadialPan: (pan: { x: number; y: number }) => void;
  setRadialZoom: (zoom: number) => void;
  // Resets all pan/zoom (both rect xZoom and radial pan/zoom) without touching layout/styles.
  resetZoom: () => void;
  resetStyles: () => void;
  // Full reset: original root, cleared styles/selection/collapse, cleared search, reset zoom.
  resetAll: () => void;
  // Called when a new tree is loaded — replaces flatTree, clears all state.
  setFlatTree: (ft: FlatTree) => void;
  // Resets back to the originally loaded tree (O(1)), clearing styles and collapsed.
  resetRoot: () => void;
  // Reroots on the branch leading to nodeId. Styles and collapsed state are preserved.
  rerootOnBranch: (nodeId: NodeId) => void;
  // Rotates children of targetId. Styles and collapsed state are preserved.
  rotateNode: (targetId: NodeId) => void;
  toggleCollapse: (nodeId: NodeId) => void;
  setNodeStyle: (key: string, style: Partial<NodeStyle>) => void;
  clearNodeStyle: (key: string) => void;
  setBranchStyle: (key: string, color: string) => void;
  clearBranchStyle: (key: string) => void;
  setSelectedNodeId: (id: NodeId | null) => void;
  setShowBootstrap: (show: boolean) => void;
  setBootstrapThreshold: (n: number) => void;
  setSearchQuery: (q: string) => void;
  setSearchUseRegex: (b: boolean) => void;
  setDragEnabled: (enabled: boolean) => void;
  setBranchWidth: (n: number) => void;
  setLabelFontSize: (n: number) => void;
  setNodeRadius: (n: number) => void;
  setShowBranchLengths: (b: boolean) => void;
  setShowScaleBar: (b: boolean) => void;
  // Topologically removes every non-root internal node whose parsed bootstrap
  // value is below `threshold`, producing polytomies. Snapshots the current
  // tree first so revertBootstrapCollapse can restore it.
  collapseBelowBootstrap: (threshold: number) => void;
  // Restores the snapshot taken by the most recent collapseBelowBootstrap call.
  // No-op if no snapshot exists.
  revertBootstrapCollapse: () => void;
  // Sort children of every internal node by descendant leaf count (asc or desc).
  ladderize: (direction: "asc" | "desc") => void;
  // Rotates all internal nodes so leaves appear in desiredLeafNames order.
  // Commits to flatTree. Does NOT sync sequenceStore — caller must do that.
  rotateLeavesToOrder: (desiredLeafNames: string[]) => void;
  // Set/clear a transient preview tree for live drag animation (never committed to sequenceStore).
  setPreviewFlatTree: (ft: FlatTree | null) => void;
  // Reroot at the midpoint of the longest patristic path. Preserves styles.
  midpointRootTree: () => void;
};

export const useTreeStore = create<TreeState>((set) => ({
  layoutMode: "rectangular",
  yStep: 22,
  xZoom: 1,
  radialPan: { x: 0, y: 0 },
  radialZoom: 1,
  flatTree: null,
  previewFlatTree: null,
  preCollapseFlatTree: null,
  collapsedNodes: new Set(),
  nodeStyles: new Map(),
  branchStyles: new Map(),
  selectedNodeId: null,
  showBootstrap: true,
  bootstrapThreshold: 0,
  searchQuery: "",
  searchUseRegex: false,
  dragEnabled: true,
  branchWidth: 1,
  labelFontSize: 12,
  nodeRadius: 3,
  showBranchLengths: false,
  showScaleBar: true,

  setLayoutMode: (layoutMode) => set({ layoutMode, xZoom: 1, radialPan: { x: 0, y: 0 }, radialZoom: 1 }),

  setYStep: (yStep) => set({ yStep }),

  setXZoom: (xZoom) => set({ xZoom: Math.max(0.1, Math.min(100, xZoom)) }),

  setRadialPan: (radialPan) => set({ radialPan }),

  setRadialZoom: (radialZoom) => set({ radialZoom: Math.max(0.1, Math.min(20, radialZoom)) }),

  resetZoom: () => set({ xZoom: 1, radialPan: { x: 0, y: 0 }, radialZoom: 1 }),

  resetStyles: () => set({ ...VIEW_STATE_RESET }),

  resetAll: () =>
    set({
      flatTree: _originalFlatTree,
      ...VIEW_STATE_RESET,
      preCollapseFlatTree: null,
      searchQuery: "",
      xZoom: 1,
      radialPan: { x: 0, y: 0 },
      radialZoom: 1,
    }),

  setFlatTree: (ft) => {
    _originalFlatTree = ft;
    set({
      flatTree: ft,
      ...VIEW_STATE_RESET,
      preCollapseFlatTree: null,
      xZoom: 1,
      radialPan: { x: 0, y: 0 },
      radialZoom: 1,
    });
  },

  resetRoot: () => set({ flatTree: _originalFlatTree, ...VIEW_STATE_RESET, preCollapseFlatTree: null }),

  rerootOnBranch: (nodeId) =>
    set((s) => {
      if (!s.flatTree) return {};
      const newTree = rerootFlat(s.flatTree, nodeId);
      return {
        flatTree: newTree,
        collapsedNodes: pruneCollapsed(s.collapsedNodes, newTree),
        selectedNodeId: null,
      };
    }),

  rotateNode: (targetId) =>
    set((s) => {
      if (!s.flatTree) return {};
      return { flatTree: rotateFlat(s.flatTree, targetId) };
    }),

  toggleCollapse: (nodeId) =>
    set((s) => {
      const next = new Set(s.collapsedNodes);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return { collapsedNodes: next };
    }),

  setNodeStyle: (key, style) =>
    set((s) => {
      const next = new Map(s.nodeStyles);
      const existing = next.get(key) ?? { color: "#111111", labelBold: false };
      next.set(key, { ...existing, ...style });
      return { nodeStyles: next };
    }),

  clearNodeStyle: (key) =>
    set((s) => {
      const next = new Map(s.nodeStyles);
      next.delete(key);
      return { nodeStyles: next };
    }),

  setBranchStyle: (key, color) =>
    set((s) => {
      const next = new Map(s.branchStyles);
      next.set(key, { color });
      return { branchStyles: next };
    }),

  clearBranchStyle: (key) =>
    set((s) => {
      const next = new Map(s.branchStyles);
      next.delete(key);
      return { branchStyles: next };
    }),

  setSelectedNodeId: (selectedNodeId) => set({ selectedNodeId }),

  setShowBootstrap: (showBootstrap) => set({ showBootstrap }),

  setBootstrapThreshold: (bootstrapThreshold) => set({ bootstrapThreshold: Math.max(0, Math.min(100, bootstrapThreshold)) }),

  setSearchQuery: (searchQuery) => set({ searchQuery }),

  setSearchUseRegex: (searchUseRegex) => set({ searchUseRegex }),

  setDragEnabled: (dragEnabled) => set({ dragEnabled }),

  setBranchWidth: (branchWidth) => set({ branchWidth: Math.max(0.5, Math.min(6, branchWidth)) }),

  setLabelFontSize: (labelFontSize) => set({ labelFontSize: Math.max(8, Math.min(24, labelFontSize)) }),

  setNodeRadius: (nodeRadius) => set({ nodeRadius: Math.max(0, Math.min(8, nodeRadius)) }),

  setShowBranchLengths: (showBranchLengths) => set({ showBranchLengths }),

  setShowScaleBar: (showScaleBar) => set({ showScaleBar }),

  collapseBelowBootstrap: (threshold) =>
    set((s) => {
      if (!s.flatTree) return {};
      const newTree = collapsePolytomiesByBootstrap(s.flatTree, threshold);
      if (newTree === s.flatTree) return {}; // no node matched — no snapshot, no churn
      return {
        flatTree: newTree,
        preCollapseFlatTree: s.flatTree,
        collapsedNodes: pruneCollapsed(s.collapsedNodes, newTree),
        nodeStyles: pruneStylesForRemovedNodes(s.nodeStyles, newTree),
        branchStyles: pruneStylesForRemovedNodes(s.branchStyles, newTree),
        selectedNodeId:
          s.selectedNodeId !== null && !newTree.nodes.has(s.selectedNodeId)
            ? null
            : s.selectedNodeId,
      };
    }),

  revertBootstrapCollapse: () =>
    set((s) => {
      if (!s.preCollapseFlatTree) return {};
      return { flatTree: s.preCollapseFlatTree, preCollapseFlatTree: null };
    }),

  ladderize: (direction) =>
    set((s) => {
      if (!s.flatTree) return {};
      const newTree = ladderize(s.flatTree, direction);
      const leafNames = newTree.leafOrder.map((id) => newTree.nodes.get(id)!.name);
      useSequenceStore.getState().syncFromTreeLeafOrder(leafNames);
      return { flatTree: newTree };
    }),

  rotateLeavesToOrder: (desiredLeafNames) =>
    set((s) => {
      if (!s.flatTree) return {};
      return { flatTree: rotateFlatToOrder(s.flatTree, desiredLeafNames), previewFlatTree: null };
    }),

  setPreviewFlatTree: (previewFlatTree) => set({ previewFlatTree }),

  midpointRootTree: () =>
    set((s) => {
      if (!s.flatTree || s.flatTree.leafOrder.length < 2) return {};
      const newTree = midpointRoot(s.flatTree);
      return {
        flatTree: newTree,
        collapsedNodes: pruneCollapsed(s.collapsedNodes, newTree),
        selectedNodeId: null,
      };
    }),
}));
