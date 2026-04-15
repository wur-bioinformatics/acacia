import type { FlatNode, FlatTree, LayoutMode, LayoutNode, NodeId, TreeNode } from "./types";

// ---------------------------------------------------------------------------
// Newick parsing
// ---------------------------------------------------------------------------

export function parseNewick(s: string): TreeNode {
  let i = 0;

  function parseNode(): TreeNode {
    const node: TreeNode = { name: "", length: 0, children: [] };

    while (i < s.length && " \t\n\r".includes(s[i])) i++;

    if (i < s.length && s[i] === "(") {
      i++; // consume '('
      node.children.push(parseNode());
      while (i < s.length && s[i] === ",") {
        i++; // consume ','
        node.children.push(parseNode());
      }
      if (i < s.length && s[i] === ")") i++; // consume ')'
    }

    while (i < s.length && " \t".includes(s[i])) i++;
    const nameStart = i;
    while (i < s.length && !":,);".includes(s[i])) i++;
    node.name = s.slice(nameStart, i).trim();

    if (i < s.length && s[i] === ":") {
      i++;
      const lenStart = i;
      while (i < s.length && !",);".includes(s[i])) i++;
      node.length = parseFloat(s.slice(lenStart, i)) || 0;
    }

    return node;
  }

  return parseNode();
}

// ---------------------------------------------------------------------------
// Flatten parsed tree into a FlatTree (single source of truth)
// ---------------------------------------------------------------------------

// Assigns stable IDs in DFS preorder: "n0" (root), "n1", "n2", …
// These IDs survive reroots and rotations.
export function flattenTree(root: TreeNode): FlatTree {
  const nodes = new Map<NodeId, FlatNode>();
  const leafOrder: NodeId[] = [];
  let counter = 0;

  function dfs(node: TreeNode, parentId: NodeId | null): NodeId {
    const id: NodeId = `n${counter++}`;
    const childIds: NodeId[] = node.children.map((child) => dfs(child, id));
    if (childIds.length === 0) leafOrder.push(id);
    nodes.set(id, { id, name: node.name, length: node.length, parentId, childIds, leafCount: 0 });
    return id;
  }

  const rootId = dfs(root, null);
  computeFlatLeafCounts(nodes, rootId);
  return { nodes, rootId, originalRootId: rootId, leafOrder };
}

function computeFlatLeafCounts(nodes: Map<NodeId, FlatNode>, rootId: NodeId): void {
  function walk(id: NodeId): number {
    const node = nodes.get(id)!;
    if (node.childIds.length === 0) {
      node.leafCount = 1;
      return 1;
    }
    const total = node.childIds.reduce((s, cid) => s + walk(cid), 0);
    node.leafCount = total;
    return total;
  }
  walk(rootId);
}

// ---------------------------------------------------------------------------
// Reroot on a branch
// ---------------------------------------------------------------------------

// Reroots the tree so the branch leading to targetId becomes the new root.
// Only clones nodes on the path from targetId to the old root (O(path length)).
// Non-path nodes are shared by reference. Node count stays constant:
// the old root node is repurposed as the new virtual root.
// Preserves originalRootId unchanged.
export function rerootFlat(tree: FlatTree, targetId: NodeId): FlatTree {
  const { nodes, rootId } = tree;
  const target = nodes.get(targetId);
  if (!target || target.parentId === null) return tree; // already root or not found

  // Collect path from target up to (but not including) root.
  const path: NodeId[] = [];
  let cur: NodeId = targetId;
  while (cur !== rootId) {
    path.push(cur);
    const n = nodes.get(cur)!;
    if (n.parentId === null) break; // shouldn't happen
    cur = n.parentId;
  }
  // cur is now rootId (or we broke early)
  path.push(rootId);

  // Clone all nodes on the path (copy-on-write; non-path nodes shared).
  const newNodes = new Map(nodes);
  for (const id of path) {
    const n = nodes.get(id)!;
    newNodes.set(id, { ...n, childIds: [...n.childIds] });
  }

  // Reverse parent/child pointers along the path.
  // path = [target, p1, p2, ..., oldRoot]
  const halfLen = newNodes.get(targetId)!.length / 2;

  for (let i = 0; i < path.length - 1; i++) {
    const childId = path[i];
    const parentId = path[i + 1];
    const childNode = newNodes.get(childId)!;
    const parentNode = newNodes.get(parentId)!;

    // Remove childId from parent's children; add parentId to child's children.
    parentNode.childIds = parentNode.childIds.filter((id) => id !== childId);
    childNode.childIds = [...childNode.childIds, parentId];
    // The parent now hangs off the child; give it the length the child used to have.
    parentNode.length = childNode.length;
    // Child's length will be set below (only target gets halfLen).
    childNode.parentId = null; // will be fixed when we set up the new virtual root
  }

  // Repurpose the old root as the new virtual root between target and its old parent.
  const targetParentId = path[1]; // was the parent of target before reroot
  const oldRootNode = newNodes.get(rootId)!;
  const targetNode = newNodes.get(targetId)!;

  // New virtual root: two children = [target, targetParent]
  oldRootNode.name = "";
  oldRootNode.length = 0;
  oldRootNode.parentId = null;
  oldRootNode.childIds = [targetId, targetParentId];

  // target gets halfLen, old parent (now a child of root) keeps the other half
  targetNode.length = halfLen;
  targetNode.parentId = rootId;
  newNodes.get(targetParentId)!.length = halfLen;
  newNodes.get(targetParentId)!.parentId = rootId;

  // Recompute leafCount bottom-up (unavoidable after reroot).
  computeFlatLeafCounts(newNodes, rootId);

  return { nodes: newNodes, rootId, originalRootId: tree.originalRootId, leafOrder: tree.leafOrder };
}

// ---------------------------------------------------------------------------
// Rotate (reverse children of one node)
// ---------------------------------------------------------------------------

// Clones only the target node; all other nodes are shared. O(1) work.
// No ID remapping needed — IDs are stable.
export function rotateFlat(tree: FlatTree, targetId: NodeId): FlatTree {
  const target = tree.nodes.get(targetId);
  if (!target) return tree;
  const newNodes = new Map(tree.nodes);
  newNodes.set(targetId, { ...target, childIds: [...target.childIds].reverse() });
  return { ...tree, nodes: newNodes };
}

// ---------------------------------------------------------------------------
// Layout result type
// ---------------------------------------------------------------------------

export type LayoutResult = {
  root: LayoutNode;
  nLeaves: number;
  maxDepth: number; // used for x-scaling and scale bar
};

// ---------------------------------------------------------------------------
// Rectangular (phylogram) layout
// ---------------------------------------------------------------------------

export function buildRectLayout(
  flatNodes: Map<NodeId, FlatNode>,
  rootId: NodeId,
  yStep: number,
  collapsedNodes: ReadonlySet<NodeId>,
): LayoutResult {
  let leafIdx = 0;
  let maxDepth = 0;

  function build(id: NodeId, depth: number): LayoutNode {
    const flatNode = flatNodes.get(id)!;
    const lc = flatNode.leafCount;

    if (collapsedNodes.has(id) || flatNode.childIds.length === 0) {
      const y = leafIdx++ * yStep;
      if (depth > maxDepth) maxDepth = depth;
      return { node: { name: flatNode.name, length: flatNode.length, children: [] }, id, x: depth, y, children: [], leafCount: lc };
    }

    const children = flatNode.childIds.map((cid) => {
      const child = flatNodes.get(cid)!;
      return build(cid, depth + child.length);
    });
    const y = (children[0].y + children[children.length - 1].y) / 2;

    return { node: { name: flatNode.name, length: flatNode.length, children: [] }, id, x: depth, y, children, leafCount: lc };
  }

  const layoutRoot = build(rootId, 0);
  return { root: layoutRoot, nLeaves: leafIdx, maxDepth };
}

// ---------------------------------------------------------------------------
// Cladogram layout (equal branch lengths, all leaves aligned)
// ---------------------------------------------------------------------------

export function buildCladogramLayout(
  flatNodes: Map<NodeId, FlatNode>,
  rootId: NodeId,
  yStep: number,
  collapsedNodes: ReadonlySet<NodeId>,
): LayoutResult {
  // Precompute hops from each node to its farthest descendant leaf.
  const hopMap = new Map<NodeId, number>();

  function precompute(id: NodeId): number {
    const node = flatNodes.get(id)!;
    if (node.childIds.length === 0) {
      hopMap.set(id, 0);
      return 0;
    }
    const h = 1 + Math.max(...node.childIds.map(precompute));
    hopMap.set(id, h);
    return h;
  }

  const maxHops = precompute(rootId);
  let leafIdx = 0;

  function build(id: NodeId): LayoutNode {
    const flatNode = flatNodes.get(id)!;
    const lc = flatNode.leafCount;
    const hops = hopMap.get(id) ?? 0;
    const x = maxHops - hops; // leaves have x = maxHops, root has x = 0

    if (collapsedNodes.has(id) || flatNode.childIds.length === 0) {
      const y = leafIdx++ * yStep;
      return { node: { name: flatNode.name, length: flatNode.length, children: [] }, id, x, y, children: [], leafCount: lc };
    }

    const children = flatNode.childIds.map((cid) => build(cid));
    const y = (children[0].y + children[children.length - 1].y) / 2;

    return { node: { name: flatNode.name, length: flatNode.length, children: [] }, id, x, y, children, leafCount: lc };
  }

  const layoutRoot = build(rootId);
  return { root: layoutRoot, nLeaves: leafIdx, maxDepth: maxHops };
}

// ---------------------------------------------------------------------------
// Radial layout
// ---------------------------------------------------------------------------

export function buildRadialLayout(
  flatNodes: Map<NodeId, FlatNode>,
  rootId: NodeId,
  maxRadius: number,
  collapsedNodes: ReadonlySet<NodeId>,
): LayoutResult {
  // Compute max cumulative branch depth for radius scaling.
  function maxBranchDepth(id: NodeId, depth: number): number {
    const node = flatNodes.get(id)!;
    if (node.childIds.length === 0) return depth;
    return Math.max(...node.childIds.map((cid) => {
      const child = flatNodes.get(cid)!;
      return maxBranchDepth(cid, depth + child.length);
    }));
  }
  const maxDepth = maxBranchDepth(rootId, 0);

  // Count total rendered leaves (respecting collapsed nodes).
  function countVisible(id: NodeId): number {
    const node = flatNodes.get(id)!;
    if (node.childIds.length === 0 || collapsedNodes.has(id)) return 1;
    return node.childIds.reduce((s, cid) => s + countVisible(cid), 0);
  }
  const totalLeaves = countVisible(rootId);
  const angleStep = (2 * Math.PI) / totalLeaves;

  let leafIdx = 0;

  function build(id: NodeId, depth: number): LayoutNode {
    const flatNode = flatNodes.get(id)!;
    const lc = flatNode.leafCount;
    const r = maxDepth > 0 ? (depth / maxDepth) * maxRadius : 0;

    if (collapsedNodes.has(id) || flatNode.childIds.length === 0) {
      const angle = leafIdx * angleStep;
      leafIdx++;
      return { node: { name: flatNode.name, length: flatNode.length, children: [] }, id, x: r, y: 0, angle, children: [], leafCount: lc };
    }

    const children = flatNode.childIds.map((cid) => {
      const child = flatNodes.get(cid)!;
      return build(cid, depth + child.length);
    });

    const firstAngle = children[0].angle ?? 0;
    const lastAngle = children[children.length - 1].angle ?? 0;
    const angle = (firstAngle + lastAngle) / 2;

    return { node: { name: flatNode.name, length: flatNode.length, children: [] }, id, x: r, y: 0, angle, children, leafCount: lc };
  }

  const layoutRoot = build(rootId, 0);
  return { root: layoutRoot, nLeaves: leafIdx, maxDepth };
}

// ---------------------------------------------------------------------------
// Layout dispatcher
// ---------------------------------------------------------------------------

export function buildLayout(
  tree: FlatTree,
  mode: LayoutMode,
  yStep: number,
  maxRadius: number,
  collapsedNodes: ReadonlySet<NodeId>,
): LayoutResult {
  switch (mode) {
    case "rectangular":
      return buildRectLayout(tree.nodes, tree.rootId, yStep, collapsedNodes);
    case "cladogram":
      return buildCladogramLayout(tree.nodes, tree.rootId, yStep, collapsedNodes);
    case "radial":
      return buildRadialLayout(tree.nodes, tree.rootId, maxRadius, collapsedNodes);
  }
}

// ---------------------------------------------------------------------------
// Layout utilities
// ---------------------------------------------------------------------------

export function findLayoutNode(root: LayoutNode, id: string): LayoutNode | null {
  if (root.id === id) return root;
  for (const child of root.children) {
    const found = findLayoutNode(child, id);
    if (found) return found;
  }
  return null;
}

// Returns all descendant LayoutNodes (including the given node).
export function getSubtreeNodes(node: LayoutNode): LayoutNode[] {
  const result: LayoutNode[] = [node];
  for (const child of node.children) result.push(...getSubtreeNodes(child));
  return result;
}

export function truncate(s: string, max = 32): string {
  return s.length > max ? s.slice(0, max) + "…" : s;
}
