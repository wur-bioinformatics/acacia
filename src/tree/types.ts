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
  didDragRef: React.RefObject<boolean>;
} & (RectGeomProps | RadialGeomProps);

export type LayoutNode = {
  node: TreeNode;
  id: string; // path string: "r", "r-0", "r-0-1", etc.
  x: number; // cumulative branch depth (or hop count for cladogram, radius for radial)
  y: number; // leaf index * yStep (not used for radial rendering, but kept for consistency)
  angle?: number; // angle in radians, only populated for radial layout
  children: LayoutNode[];
  leafCount: number; // total leaf count under this node (for collapsed triangles)
};
