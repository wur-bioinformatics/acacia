import type { FlatNode, FlatTree, NodeId } from "../types";

// ---------------------------------------------------------------------------
// Midpoint rooting
// ---------------------------------------------------------------------------
// Roots the tree at the midpoint of its longest patristic path. Operates on
// an undirected adjacency view of the tree so the result is invariant to the
// input's current rooting — different rootings of the same unrooted tree
// produce identical output.
//
// Two-sweep is deterministic: ties in farthest-leaf are broken by NodeId.
// The original rootId, if degree-2 in the unrooted tree (i.e. a previous
// virtual root from rerootFlat or a conventionally-rooted binary input),
// is collapsed before midpoint computation so it doesn't distort the metric.
// Its ID is then reused as the new virtual root, preserving any ID-keyed
// state (node styles, collapsed flags) on the root.

type Adjacency = Map<NodeId, Map<NodeId, number>>;

function buildAdjacency(tree: FlatTree): Adjacency {
  const adj: Adjacency = new Map();
  for (const id of tree.nodes.keys()) adj.set(id, new Map());
  for (const [id, node] of tree.nodes) {
    if (node.parentId !== null) {
      adj.get(id)!.set(node.parentId, node.length);
      adj.get(node.parentId)!.set(id, node.length);
    }
  }
  return adj;
}

// Patristic-distance traversal of an undirected tree.
function distancesFrom(
  adj: Adjacency,
  startId: NodeId,
): { dist: Map<NodeId, number>; predecessor: Map<NodeId, NodeId | null> } {
  const dist = new Map<NodeId, number>();
  const predecessor = new Map<NodeId, NodeId | null>();
  dist.set(startId, 0);
  predecessor.set(startId, null);
  const stack: NodeId[] = [startId];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    for (const [neighbor, len] of adj.get(cur)!) {
      if (dist.has(neighbor)) continue;
      dist.set(neighbor, dist.get(cur)! + len);
      predecessor.set(neighbor, cur);
      stack.push(neighbor);
    }
  }
  return { dist, predecessor };
}

// Farthest leaf (degree-1 node) from start. Tie-break by NodeId for
// rooting-independent determinism.
function farthestLeaf(adj: Adjacency, dist: Map<NodeId, number>): NodeId {
  let bestId: NodeId | null = null;
  let bestDist = -Infinity;
  for (const [id, d] of dist) {
    if (adj.get(id)!.size !== 1) continue;
    if (d > bestDist || (d === bestDist && bestId !== null && id < bestId)) {
      bestDist = d;
      bestId = id;
    }
  }
  return bestId ?? [...adj.keys()][0];
}

function pathTo(predecessor: Map<NodeId, NodeId | null>, endId: NodeId): NodeId[] {
  const path: NodeId[] = [];
  let cur: NodeId | null = endId;
  while (cur !== null) {
    path.push(cur);
    cur = predecessor.get(cur) ?? null;
  }
  return path.reverse();
}

// Pick a fresh NodeId not already used in the tree.
function freshNodeId(taken: Iterable<NodeId>): NodeId {
  const set = new Set(taken);
  let i = 0;
  while (set.has(`n${i}`)) i++;
  return `n${i}`;
}

export function midpointRoot(tree: FlatTree): FlatTree {
  if (tree.leafOrder.length < 2) return tree;

  const adj = buildAdjacency(tree);
  const names = new Map<NodeId, string>();
  for (const [id, node] of tree.nodes) names.set(id, node.name);

  // Collapse the original root if it's degree-2 in the unrooted view. This
  // is the conventional shape of a binary rooted tree's virtual root; leaving
  // it in place would split the diameter path's edge through a phantom node
  // and skew midpoint placement. Free the ID for reuse as the new virtual root.
  let preservedRootId: NodeId | null = null;
  const rootEntry = adj.get(tree.rootId);
  if (rootEntry && rootEntry.size === 2) {
    const [n1, n2] = [...rootEntry.keys()];
    const merged = rootEntry.get(n1)! + rootEntry.get(n2)!;
    adj.get(n1)!.delete(tree.rootId);
    adj.get(n2)!.delete(tree.rootId);
    adj.get(n1)!.set(n2, merged);
    adj.get(n2)!.set(n1, merged);
    adj.delete(tree.rootId);
    names.delete(tree.rootId);
    preservedRootId = tree.rootId;
  }

  // Two-sweep diameter on the (possibly collapsed) unrooted tree.
  let seed: NodeId | null = null;
  for (const [id, neighbors] of adj) if (neighbors.size === 1) { seed = id; break; }
  if (seed === null) return tree;
  const { dist: distFromSeed } = distancesFrom(adj, seed);
  const leafA = farthestLeaf(adj, distFromSeed);
  const { dist: distFromA, predecessor } = distancesFrom(adj, leafA);
  const leafB = farthestLeaf(adj, distFromA);
  const totalDist = distFromA.get(leafB) ?? 0;
  if (totalDist === 0) return tree;
  const midpoint = totalDist / 2;
  const path = pathTo(predecessor, leafB);

  // Find the edge on the diameter path that contains the midpoint.
  let cumulative = 0;
  let uIdx = 0;
  let edgeLength = 0;
  for (let i = 1; i < path.length; i++) {
    const len = adj.get(path[i - 1])!.get(path[i])!;
    if (cumulative + len >= midpoint) {
      uIdx = i - 1;
      edgeLength = len;
      break;
    }
    cumulative += len;
  }
  const u = path[uIdx];
  const v = path[uIdx + 1];
  const distFromU = midpoint - cumulative;
  const distFromV = edgeLength - distFromU;

  // Insert a new virtual root between u and v. Reuse the original rootId when
  // it was collapsed above; otherwise mint a fresh ID (rare: only when the
  // input root is a polytomy of degree ≥3).
  const newRootId =
    preservedRootId !== null && !adj.has(preservedRootId)
      ? preservedRootId
      : freshNodeId(adj.keys());

  adj.get(u)!.delete(v);
  adj.get(v)!.delete(u);
  adj.set(newRootId, new Map([[u, distFromU], [v, distFromV]]));
  adj.get(u)!.set(newRootId, distFromU);
  adj.get(v)!.set(newRootId, distFromV);
  names.set(newRootId, "");

  // Build the new FlatTree by DFS from the new virtual root.
  const newNodes = new Map<NodeId, FlatNode>();
  function dfs(id: NodeId, parentId: NodeId | null, lengthToParent: number): number {
    const childIds: NodeId[] = [];
    for (const [neighbor] of adj.get(id)!) {
      if (neighbor !== parentId) childIds.push(neighbor);
    }
    let leafCount = 0;
    for (const cid of childIds) {
      leafCount += dfs(cid, id, adj.get(id)!.get(cid)!);
    }
    if (childIds.length === 0) leafCount = 1;
    newNodes.set(id, {
      id,
      name: names.get(id) ?? "",
      length: lengthToParent,
      parentId,
      childIds,
      leafCount,
    });
    return leafCount;
  }
  dfs(newRootId, null, 0);

  const leafOrder: NodeId[] = [];
  function collectLeaves(id: NodeId) {
    const node = newNodes.get(id)!;
    if (node.childIds.length === 0) { leafOrder.push(id); return; }
    node.childIds.forEach(collectLeaves);
  }
  collectLeaves(newRootId);

  return {
    nodes: newNodes,
    rootId: newRootId,
    originalRootId: tree.originalRootId,
    isRerooted: true,
    leafOrder,
  };
}
