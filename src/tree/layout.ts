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
  return { nodes, rootId, originalRootId: rootId, isRerooted: false, leafOrder };
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
  //
  // Rules:
  //   i === 0 (target): remove target from parent's children; do NOT add parent to
  //     target's children — target keeps its own subtree unchanged.
  //   0 < i < path.length-2 (internal path node): full reversal — remove from parent,
  //     add parent as child.
  //   i === path.length-2 (last step, parentId === oldRoot): remove path-child from
  //     oldRoot; do NOT add oldRoot to path-child's children (oldRoot is repurposed).
  //     Instead, transfer oldRoot's remaining children to path-child below.
  const halfLen = newNodes.get(targetId)!.length / 2;

  for (let i = 0; i < path.length - 1; i++) {
    const childId = path[i];
    const parentId = path[i + 1];
    const childNode = newNodes.get(childId)!;
    const parentNode = newNodes.get(parentId)!;

    parentNode.childIds = parentNode.childIds.filter((id) => id !== childId);

    if (i > 0 && i < path.length - 2) {
      // Internal path node: add former parent as a new child (reversal).
      childNode.childIds = [...childNode.childIds, parentId];
    }

    parentNode.length = childNode.length;
    childNode.parentId = null; // will be fixed below
  }

  // Repurpose the old root as the new virtual root between target and its old parent.
  const targetParentId = path[1]; // was the parent of target before reroot
  const oldRootNode = newNodes.get(rootId)!;
  const targetNode = newNodes.get(targetId)!;

  // oldRoot's remaining children (non-path siblings) must be rehomed to the node that was
  // the immediate child of oldRoot on the path (path[path.length-2]), so they are not lost.
  // When path.length === 2 targetParentId === rootId so oldRoot IS the new virtual root and
  // those children simply stay put.
  if (path.length > 2) {
    const lastPathChild = path[path.length - 2]; // immediate child of oldRoot on the path
    const orphans = oldRootNode.childIds; // path-child was already removed by loop
    for (const cid of orphans) {
      newNodes.get(cid)!.parentId = lastPathChild;
    }
    newNodes.get(lastPathChild)!.childIds = [...newNodes.get(lastPathChild)!.childIds, ...orphans];
    oldRootNode.childIds = [targetId, targetParentId];
  } else {
    // path.length === 2: targetParentId === rootId, old root stays as virtual root.
    oldRootNode.childIds = [targetId, ...oldRootNode.childIds]; // childIds already has target removed
  }

  oldRootNode.name = "";
  oldRootNode.length = 0;
  oldRootNode.parentId = null;

  targetNode.length = halfLen;
  targetNode.parentId = rootId;

  if (path.length > 2) {
    newNodes.get(targetParentId)!.length = halfLen;
    newNodes.get(targetParentId)!.parentId = rootId;
  }

  // Fix parentId for intermediate path nodes (path[2] .. path[path.length-2]).
  // The loop set them all to null but only target and targetParent are fixed above.
  for (let k = 2; k <= path.length - 2; k++) {
    newNodes.get(path[k])!.parentId = path[k - 1];
  }

  // Recompute leafCount bottom-up (unavoidable after reroot).
  computeFlatLeafCounts(newNodes, rootId);

  return { nodes: newNodes, rootId, originalRootId: tree.originalRootId, isRerooted: true, leafOrder: tree.leafOrder };
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
// Branch key helpers
// ---------------------------------------------------------------------------

export function branchKey(node: LayoutNode): string {
  return node.children.length === 0
    ? `branch:leaf:${node.node.name}`
    : `branch:${node.id}`;
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

function buildRectLayout(
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

function buildCladogramLayout(
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

function buildRadialLayout(
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
