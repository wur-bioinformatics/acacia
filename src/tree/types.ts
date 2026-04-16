export type TreeNode = {
  name: string;
  length: number;
  children: TreeNode[];
};

export type LayoutMode = "rectangular" | "cladogram" | "radial";

export type NodeStyle = {
  color: string;
  labelBold: boolean;
};

export type BranchStyle = {
  color: string;
};

export type RectGeomProps = {
  mode: "rect";
  parentX: number;
  xScale: number;
  treeWidth: number;
};

export type RadialGeomProps = {
  mode: "radial";
  parentR: number;
  cx: number;
  cy: number;
  maxRadius: number;
};

export type BranchesProps = {
  node: LayoutNode;
  isRoot: boolean;
  onNodeClick: (node: LayoutNode, e: React.MouseEvent) => void;
  onBranchClick: (node: LayoutNode, e: React.MouseEvent) => void;
} & (RectGeomProps | RadialGeomProps);

export type LayoutNode = {
  node: TreeNode;
  id: NodeId; // stable NodeId: "n0", "n5", etc. — survives reroots and rotations
  x: number; // cumulative branch depth (or hop count for cladogram, radius for radial)
  y: number; // leaf index * yStep (not used for radial rendering, but kept for consistency)
  angle?: number; // angle in radians, only populated for radial layout
  children: LayoutNode[];
  leafCount: number; // total leaf count under this node (for collapsed triangles)
};

// ---------------------------------------------------------------------------
// Flat tree — single source of truth
// ---------------------------------------------------------------------------

export type NodeId = string; // opaque — DFS preorder index: "n0", "n1", …

export type FlatNode = {
  id: NodeId;
  name: string; // leaf: sequence identifier; internal: bootstrap value or ""
  length: number; // branch length to parent (0 for root)
  parentId: NodeId | null;
  childIds: NodeId[];
  leafCount: number; // subtree leaf count; recomputed after reroot
};

export type FlatTree = {
  nodes: Map<NodeId, FlatNode>;
  rootId: NodeId;
  originalRootId: NodeId; // never changes; used for "Reset root" disabled state in UI
  isRerooted: boolean; // true if rerootFlat has been applied at least once
  leafOrder: NodeId[]; // DFS in-order leaf IDs; used to seed sequenceStore on load
};

export type PanelState = {
  id: string;
  isLeaf: boolean;
  leafName?: string;
  x: number;
  y: number;
};
