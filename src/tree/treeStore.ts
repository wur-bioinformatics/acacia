import { create } from "zustand";
import type { BranchStyle, FlatTree, LayoutMode, NodeId, NodeStyle } from "./types";
import { rerootFlat, rotateFlat, rotateFlatToOrder } from "./layout";

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
  flatTree: FlatTree | null;
  // Ephemeral tree used during label drag — rendered instead of flatTree, never committed.
  // Set on each hover-index change during drag; cleared on drop or cancel.
  previewFlatTree: FlatTree | null;
  collapsedNodes: ReadonlySet<NodeId>;
  nodeStyles: ReadonlyMap<string, NodeStyle>;
  // Keys: "branch:leaf:<leafName>" (stable) or "branch:<nodeId>"
  branchStyles: ReadonlyMap<string, BranchStyle>;
  selectedNodeId: NodeId | null;
  showBootstrap: boolean;

  setLayoutMode: (mode: LayoutMode) => void;
  setYStep: (yStep: number) => void;
  resetStyles: () => void;
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
  // Rotates all internal nodes so leaves appear in desiredLeafNames order.
  // Commits to flatTree. Does NOT sync sequenceStore — caller must do that.
  rotateLeavesToOrder: (desiredLeafNames: string[]) => void;
  // Set/clear a transient preview tree for live drag animation (never committed to sequenceStore).
  setPreviewFlatTree: (ft: FlatTree | null) => void;
};

export const useTreeStore = create<TreeState>((set) => ({
  layoutMode: "rectangular",
  yStep: 22,
  flatTree: null,
  previewFlatTree: null,
  collapsedNodes: new Set(),
  nodeStyles: new Map(),
  branchStyles: new Map(),
  selectedNodeId: null,
  showBootstrap: true,

  setLayoutMode: (layoutMode) => set({ layoutMode }),

  setYStep: (yStep) => set({ yStep }),

  resetStyles: () =>
    set({
      collapsedNodes: new Set(),
      nodeStyles: new Map(),
      branchStyles: new Map(),
      selectedNodeId: null,
    }),

  setFlatTree: (ft) => {
    _originalFlatTree = ft;
    set({
      flatTree: ft,
      collapsedNodes: new Set(),
      nodeStyles: new Map(),
      branchStyles: new Map(),
      selectedNodeId: null,
    });
  },

  resetRoot: () =>
    set({
      flatTree: _originalFlatTree,
      collapsedNodes: new Set(),
      nodeStyles: new Map(),
      branchStyles: new Map(),
      selectedNodeId: null,
    }),

  rerootOnBranch: (nodeId) =>
    set((s) => {
      if (!s.flatTree) return {};
      return {
        flatTree: rerootFlat(s.flatTree, nodeId),
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

  rotateLeavesToOrder: (desiredLeafNames) =>
    set((s) => {
      if (!s.flatTree) return {};
      return { flatTree: rotateFlatToOrder(s.flatTree, desiredLeafNames), previewFlatTree: null };
    }),

  setPreviewFlatTree: (previewFlatTree) => set({ previewFlatTree }),
}));
