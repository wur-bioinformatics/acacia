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

  // Rerooting on a direct child of a binary root is a topological no-op: the new root
  // would have the same two children as the old root. The only "change" would be a
  // redistribution of branch length between target and its sibling — and the current
  // path-based reroot logic doesn't redistribute correctly for path.length === 2
  // (it would silently halve target's branch without compensating the sibling).
  // Return the tree unchanged so the rooting stays put.
  if (target.parentId === rootId && nodes.get(rootId)!.childIds.length === 2) return tree;

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
  //
  // Branch-length invariant: when an edge `c → p` (c is child of p in old tree) reverses
  // to `p → c` in the new tree, the new `p.length` (its distance to its new parent c)
  // equals the OLD `c.length` (the original edge length, which sat on the lower node).
  // We must read this from `nodes` (originals) — reading from cloned `childNode.length`
  // is wrong from iteration 1 onward, because the prior iteration already overwrote it.
  const halfLen = nodes.get(targetId)!.length / 2;
  const lastPathChildOldLength = path.length > 2 ? nodes.get(path[path.length - 2])!.length : 0;

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

    parentNode.length = nodes.get(childId)!.length;
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
    const orphans = [...oldRootNode.childIds]; // snapshot — path-child was already removed by loop
    for (const cid of orphans) {
      const orphan = newNodes.get(cid)!;
      // The new edge (orphan → lastPathChild) replaces the old (orphan → oldRoot) edge.
      // Geometrically the new path traverses through oldRoot's old position, so the new
      // length is orphan.length + (old lastPathChild.length).
      // Clone before mutating — orphans live outside `path` so they weren't cloned up top.
      newNodes.set(cid, {
        ...orphan,
        parentId: lastPathChild,
        length: orphan.length + lastPathChildOldLength,
      });
    }
    newNodes.get(lastPathChild)!.childIds = [...newNodes.get(lastPathChild)!.childIds, ...orphans];
    oldRootNode.childIds = [targetId, targetParentId];
  } else {
    // path.length === 2 (multifurcating root only, since binary root is short-circuited above).
    // True reroot here would split target's edge into two halves; the "other half" has no
    // single node to absorb it without inserting a new internal node. Without that, total
    // tree length cannot be preserved. Leave the legacy behavior (target.length halved,
    // siblings unchanged) — this loses halfLen of total length, which we accept until a
    // proper fix that inserts an intermediate node is implemented.
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

  return { nodes: newNodes, rootId, originalRootId: tree.originalRootId, isRerooted: true, leafOrder: buildLeafOrder(newNodes, rootId) };
}

// ---------------------------------------------------------------------------
// Leaf order helpers
// ---------------------------------------------------------------------------

function buildLeafOrder(nodes: Map<NodeId, FlatNode>, rootId: NodeId): NodeId[] {
  const order: NodeId[] = [];
  function walk(id: NodeId) {
    const node = nodes.get(id)!;
    if (node.childIds.length === 0) { order.push(id); return; }
    node.childIds.forEach(walk);
  }
  walk(rootId);
  return order;
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
  return { ...tree, nodes: newNodes, leafOrder: buildLeafOrder(newNodes, tree.rootId) };
}

// ---------------------------------------------------------------------------
// Rotate all internal nodes to match a desired leaf order
// ---------------------------------------------------------------------------

// Pure function: sorts every internal node's children so that the subtree with
// the minimum desired-position leaf comes first. Returns a new FlatTree with
// updated nodes and leafOrder; all other fields are shared by reference.
// Used both for committed reorders (via treeStore.rotateLeavesToOrder) and
// for live drag previews (via treeStore.setPreviewFlatTree).
export function rotateFlatToOrder(tree: FlatTree, desiredLeafNames: string[]): FlatTree {
  const { nodes, rootId } = tree;
  const pos = new Map(desiredLeafNames.map((n, i) => [n, i]));

  function minPos(id: NodeId): number {
    const node = nodes.get(id)!;
    if (node.childIds.length === 0) return pos.get(node.name) ?? Infinity;
    return Math.min(...node.childIds.map(minPos));
  }

  const newNodes = new Map(nodes);
  for (const [id, node] of nodes) {
    if (node.childIds.length > 0) {
      const sorted = [...node.childIds].sort((a, b) => minPos(a) - minPos(b));
      if (sorted.some((sid, i) => sid !== node.childIds[i]))
        newNodes.set(id, { ...node, childIds: sorted });
    }
  }

  const newLeafOrder: NodeId[] = [];
  function collectLeaves(id: NodeId) {
    const node = newNodes.get(id)!;
    if (node.childIds.length === 0) { newLeafOrder.push(id); return; }
    node.childIds.forEach(collectLeaves);
  }
  collectLeaves(rootId);

  return { ...tree, nodes: newNodes, leafOrder: newLeafOrder };
}

// ---------------------------------------------------------------------------
// Move subtree (SPR — subtree prune and regraft)
// ---------------------------------------------------------------------------

// Detaches `movedId`'s subtree from its current parent and re-inserts it as a sibling
// of `targetId`, immediately before or after targetId in targetId's parent's childIds.
// Used by drag-to-reorder when the desired leaf order can't be achieved by rotation alone
// (e.g. moving a clade across topology boundaries).
//
// Side effects on topology:
//   - If detaching leaves the moved node's old parent with a single remaining child, that
//     parent is collapsed (the remaining child takes its place under the grandparent, with
//     branch lengths summed). This avoids accumulating degree-2 internal nodes.
//   - Polytomies (≥3 children) at the new location are allowed.
//
// Returns null when the operation is invalid:
//   - movedId is the root (cannot detach root)
//   - movedId === targetId
//   - targetId is in movedId's subtree (would create a cycle)
//   - targetId is the root (cannot insert as sibling of root)
//
// NodeIds are preserved (no remapping). originalRootId and isRerooted carry over unchanged.
export function moveSubtreeToSibling(
  tree: FlatTree,
  movedId: NodeId,
  targetId: NodeId,
  insertAfter: boolean,
): FlatTree | null {
  const { nodes, rootId } = tree;
  if (movedId === rootId || movedId === targetId) return null;

  const movedNode = nodes.get(movedId);
  const targetNode = nodes.get(targetId);
  if (!movedNode || !targetNode) return null;
  if (targetNode.parentId === null) return null; // target is root

  // Cycle check: targetId must not be in movedId's subtree.
  function inSubtree(nodeId: NodeId, queryId: NodeId): boolean {
    if (nodeId === queryId) return true;
    const n = nodes.get(nodeId)!;
    return n.childIds.some((c) => inSubtree(c, queryId));
  }
  if (inSubtree(movedId, targetId)) return null;

  const newNodes = new Map(nodes);

  // Same-parent shortcut: pure sibling reorder, no detach/collapse/re-attach. Preserves
  // topology when the user drags a clade to swap with one of its siblings.
  if (movedNode.parentId === targetNode.parentId) {
    const parentId = movedNode.parentId!;
    const parent = newNodes.get(parentId)!;
    const without = parent.childIds.filter((c) => c !== movedId);
    const targetIdxInWithout = without.indexOf(targetId);
    const insertIdx = insertAfter ? targetIdxInWithout + 1 : targetIdxInWithout;
    const newChildIds = [...without.slice(0, insertIdx), movedId, ...without.slice(insertIdx)];
    if (newChildIds.every((id, i) => id === parent.childIds[i])) return null; // no-op
    newNodes.set(parentId, { ...parent, childIds: newChildIds });
    return { ...tree, nodes: newNodes, leafOrder: buildLeafOrder(newNodes, rootId) };
  }

  // Detach movedNode from its old parent.
  const oldParentId = movedNode.parentId!;
  const oldParent = newNodes.get(oldParentId)!;
  const remainingChildIds = oldParent.childIds.filter((c) => c !== movedId);

  // Decide whether to collapse the old parent (degree-1 internal node, but never the root).
  const shouldCollapse = remainingChildIds.length === 1 && oldParentId !== rootId;

  if (!shouldCollapse) {
    newNodes.set(oldParentId, { ...oldParent, childIds: remainingChildIds });
  } else {
    const remainingChildId = remainingChildIds[0];
    const grandparentId = oldParent.parentId!;
    const grandparent = newNodes.get(grandparentId)!;
    const remainingChild = newNodes.get(remainingChildId)!;

    // Replace oldParent in grandparent's children with remainingChild.
    const idxInGp = grandparent.childIds.indexOf(oldParentId);
    const newGpChildIds = [...grandparent.childIds];
    newGpChildIds[idxInGp] = remainingChildId;
    newNodes.set(grandparentId, { ...grandparent, childIds: newGpChildIds });

    // remainingChild adopts the collapsed node's position; branch length sums.
    newNodes.set(remainingChildId, {
      ...remainingChild,
      parentId: grandparentId,
      length: remainingChild.length + oldParent.length,
    });

    // Remove the collapsed node entirely.
    newNodes.delete(oldParentId);
  }

  // Determine target's CURRENT parent (post-collapse). If target's parent was the old parent
  // and we collapsed it, target now sits under the grandparent.
  const targetCurrentParentId =
    shouldCollapse && targetNode.parentId === oldParentId ? oldParent.parentId! : targetNode.parentId!;

  const targetCurrentParent = newNodes.get(targetCurrentParentId)!;
  const targetIdx = targetCurrentParent.childIds.indexOf(targetId);
  const insertIdx = insertAfter ? targetIdx + 1 : targetIdx;
  const newTcpChildIds = [
    ...targetCurrentParent.childIds.slice(0, insertIdx),
    movedId,
    ...targetCurrentParent.childIds.slice(insertIdx),
  ];
  newNodes.set(targetCurrentParentId, { ...targetCurrentParent, childIds: newTcpChildIds });

  // Update moved's parentId.
  newNodes.set(movedId, { ...movedNode, parentId: targetCurrentParentId });

  // Recompute leaf counts (subtree leaf counts changed for ancestors of both old and new locations).
  computeFlatLeafCounts(newNodes, rootId);
  return { ...tree, nodes: newNodes, leafOrder: buildLeafOrder(newNodes, rootId) };
}

// ---------------------------------------------------------------------------
// Collapse low-bootstrap internal nodes into polytomies
// ---------------------------------------------------------------------------

// For every non-root internal node whose `name` parses to a numeric bootstrap
// value below `threshold`, splice the node out: its children are promoted to
// be children of its parent (in place), and the removed node's branch length
// is added to each promoted child's length so patristic distances are preserved.
//
// Processed bottom-up so chains of low-support nodes collapse cleanly.
// Non-numeric internal-node names (no bootstrap parsed) are never collapsed.
// The root is never collapsed even if its name parses below threshold.
//
// Node IDs of *retained* nodes survive unchanged. Collapsed node IDs disappear
// from the returned tree's `nodes` map — callers must prune any state keyed on them.
export function collapsePolytomiesByBootstrap(tree: FlatTree, threshold: number): FlatTree {
  const { nodes, rootId } = tree;

  const toCollapse = new Set<NodeId>();
  for (const node of nodes.values()) {
    if (node.id === rootId) continue;
    if (node.childIds.length === 0) continue;
    const v = parseFloat(node.name);
    if (Number.isFinite(v) && v < threshold) toCollapse.add(node.id);
  }
  if (toCollapse.size === 0) return tree;

  // Clone every node (childIds arrays will be mutated below).
  const newNodes = new Map<NodeId, FlatNode>();
  for (const [id, node] of nodes) newNodes.set(id, { ...node, childIds: [...node.childIds] });

  // DFS preorder gives parent-before-child; reversing yields child-before-parent
  // (bottom-up), which is required so a node's `childIds` is the post-collapse
  // list when we splice it into its parent.
  const order: NodeId[] = [];
  (function dfs(id: NodeId) {
    order.push(id);
    for (const cid of newNodes.get(id)!.childIds) dfs(cid);
  })(rootId);

  for (let i = order.length - 1; i >= 0; i--) {
    const id = order[i];
    if (!toCollapse.has(id)) continue;
    const node = newNodes.get(id)!;
    const parent = newNodes.get(node.parentId!)!;
    const idx = parent.childIds.indexOf(id);
    parent.childIds.splice(idx, 1, ...node.childIds);
    for (const cid of node.childIds) {
      const child = newNodes.get(cid)!;
      child.parentId = parent.id;
      child.length = child.length + node.length;
    }
    newNodes.delete(id);
  }

  computeFlatLeafCounts(newNodes, rootId);
  return { ...tree, nodes: newNodes, leafOrder: buildLeafOrder(newNodes, rootId) };
}

// ---------------------------------------------------------------------------
// Ladderize — sort children of every internal node by descendant leaf count
// ---------------------------------------------------------------------------

// Returns a new FlatTree with childIds at every internal node sorted by leafCount.
// Pure function; non-mutated nodes shared by reference.
export function ladderize(tree: FlatTree, direction: "asc" | "desc"): FlatTree {
  const { nodes, rootId } = tree;
  const newNodes = new Map(nodes);
  const sign = direction === "asc" ? 1 : -1;

  for (const [id, node] of nodes) {
    if (node.childIds.length > 1) {
      const sorted = [...node.childIds].sort((a, b) => {
        const la = nodes.get(a)!.leafCount;
        const lb = nodes.get(b)!.leafCount;
        return sign * (la - lb);
      });
      if (sorted.some((sid, i) => sid !== node.childIds[i]))
        newNodes.set(id, { ...node, childIds: sorted });
    }
  }

  return { ...tree, nodes: newNodes, leafOrder: buildLeafOrder(newNodes, rootId) };
}

// ---------------------------------------------------------------------------
// Branch key helpers
// ---------------------------------------------------------------------------

export function branchKey(node: LayoutNode): string {
  return node.children.length === 0
    ? `branch:leaf:${node.name}`
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
      return { id, name: flatNode.name, length: flatNode.length, x: depth, y, children: [], leafCount: lc };
    }

    const children = flatNode.childIds.map((cid) => {
      const child = flatNodes.get(cid)!;
      return build(cid, depth + child.length);
    });
    const y = (children[0].y + children[children.length - 1].y) / 2;

    return { id, name: flatNode.name, length: flatNode.length, x: depth, y, children, leafCount: lc };
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
      return { id, name: flatNode.name, length: flatNode.length, x, y, children: [], leafCount: lc };
    }

    const children = flatNode.childIds.map((cid) => build(cid));
    const y = (children[0].y + children[children.length - 1].y) / 2;

    return { id, name: flatNode.name, length: flatNode.length, x, y, children, leafCount: lc };
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
      return { id, name: flatNode.name, length: flatNode.length, x: r, y: 0, angle, children: [], leafCount: lc };
    }

    const children = flatNode.childIds.map((cid) => {
      const child = flatNodes.get(cid)!;
      return build(cid, depth + child.length);
    });

    const firstAngle = children[0].angle ?? 0;
    const lastAngle = children[children.length - 1].angle ?? 0;
    const angle = (firstAngle + lastAngle) / 2;

    return { id, name: flatNode.name, length: flatNode.length, x: r, y: 0, angle, children, leafCount: lc };
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
