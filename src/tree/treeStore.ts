import { create } from "zustand";
import type { LayoutMode, NodeStyle, TreeNode } from "./types";
import { rerootTree } from "./layout";

// Node style keys:
//   - Leaf nodes:     "leaf:<sequenceName>"   (stable across reroots)
//   - Internal nodes: "<pathId>"              (e.g. "r-0-1"; invalidated by reroot)
// On reset/reroot, internal-node entries are cleared; leaf entries are preserved.

function preserveLeafStyles(nodeStyles: ReadonlyMap<string, NodeStyle>): Map<string, NodeStyle> {
  const out = new Map<string, NodeStyle>();
  for (const [key, style] of nodeStyles) {
    if (key.startsWith("leaf:")) out.set(key, style);
  }
  return out;
}

type TreeState = {
  layoutMode: LayoutMode;
  panX: number;
  panY: number;
  zoom: number;
  // The parsed tree as loaded — never modified. Used to reset back to original.
  originalRoot: TreeNode | null;
  // The current working tree (after reroot/rotate). Starts equal to originalRoot.
  root: TreeNode | null;
  collapsedNodes: ReadonlySet<string>;
  nodeStyles: ReadonlyMap<string, NodeStyle>;
  selectedNodeId: string | null;
  showBootstrap: boolean;

  setLayoutMode: (mode: LayoutMode) => void;
  setPanAndZoom: (x: number, y: number, z: number) => void;
  resetView: () => void;
  // Called when a new tree is loaded — sets both originalRoot and root, clears all state.
  setOriginalRoot: (root: TreeNode) => void;
  // Called on reroot/rotate — updates root only, clears internal-node styles/collapsed state.
  // Leaf styles (keys starting with "leaf:") are preserved.
  setRoot: (root: TreeNode) => void;
  // Resets root back to originalRoot, clearing all internal-node styles/collapsed state.
  resetRoot: () => void;
  toggleCollapse: (nodeId: string) => void;
  setNodeStyle: (key: string, style: Partial<NodeStyle>) => void;
  clearNodeStyle: (key: string) => void;
  setSelectedNodeId: (id: string | null) => void;
  setShowBootstrap: (show: boolean) => void;
  rerootOnBranch: (nodeId: string) => void;
};

export const useTreeStore = create<TreeState>((set) => ({
  layoutMode: "rectangular",
  panX: 0,
  panY: 0,
  zoom: 1,
  originalRoot: null,
  root: null,
  collapsedNodes: new Set(),
  nodeStyles: new Map(),
  selectedNodeId: null,
  showBootstrap: true,

  setLayoutMode: (layoutMode) => set({ layoutMode }),

  setPanAndZoom: (panX, panY, zoom) => set({ panX, panY, zoom }),

  resetView: () => set({ panX: 0, panY: 0, zoom: 1 }),

  setOriginalRoot: (root) =>
    set({
      originalRoot: root,
      root,
      collapsedNodes: new Set(),
      nodeStyles: new Map(),
      selectedNodeId: null,
    }),

  setRoot: (root) =>
    set((s) => ({
      root,
      collapsedNodes: new Set(),
      nodeStyles: preserveLeafStyles(s.nodeStyles),
      selectedNodeId: null,
    })),

  resetRoot: () =>
    set((s) => ({
      root: s.originalRoot,
      collapsedNodes: new Set(),
      nodeStyles: preserveLeafStyles(s.nodeStyles),
      selectedNodeId: null,
    })),

  rerootOnBranch: (nodeId) =>
    set((s) => {
      if (!s.root) return {};
      return {
        root: rerootTree(s.root, nodeId),
        collapsedNodes: new Set(),
        nodeStyles: preserveLeafStyles(s.nodeStyles),
        selectedNodeId: null,
      };
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

  setSelectedNodeId: (selectedNodeId) => set({ selectedNodeId }),

  setShowBootstrap: (showBootstrap) => set({ showBootstrap }),
}));
