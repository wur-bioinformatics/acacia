import type { LayoutMode, LayoutNode, TreeNode } from "./types";

// ---------------------------------------------------------------------------
// Newick parsing & serialization
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
// Leaf count precomputation (for collapsed-triangle sizing)
// ---------------------------------------------------------------------------

export function computeLeafCounts(root: TreeNode): Map<TreeNode, number> {
  const counts = new Map<TreeNode, number>();

  function walk(node: TreeNode): number {
    if (node.children.length === 0) {
      counts.set(node, 1);
      return 1;
    }
    const total = node.children.reduce((sum, c) => sum + walk(c), 0);
    counts.set(node, total);
    return total;
  }

  walk(root);
  return counts;
}

// ---------------------------------------------------------------------------
// Node lookup by path id
// ---------------------------------------------------------------------------

function findNodeByPath(root: TreeNode, id: string): TreeNode | null {
  if (id === "r") return root;
  const parts = id.split("-").slice(1); // drop leading "r"
  let current: TreeNode = root;
  for (const part of parts) {
    const idx = parseInt(part, 10);
    if (idx >= current.children.length) return null;
    current = current.children[idx];
  }
  return current;
}

// ---------------------------------------------------------------------------
// Reroot
// ---------------------------------------------------------------------------

export function rerootTree(root: TreeNode, targetId: string): TreeNode {
  if (targetId === "r") return root; // rerooting at the root itself is a no-op

  const targetNode = findNodeByPath(root, targetId);
  if (!targetNode) return root;

  // Build parent + branch-length maps in one O(n) pass.
  const parentMap = new Map<TreeNode, TreeNode>();
  const lengthFromParent = new Map<TreeNode, number>();

  function buildMaps(node: TreeNode) {
    for (const child of node.children) {
      parentMap.set(child, node);
      lengthFromParent.set(child, child.length);
      buildMaps(child);
    }
  }
  buildMaps(root);

  const targetParent = parentMap.get(targetNode);
  if (!targetParent) return root; // target is already the root

  const halfLen = targetNode.length / 2;

  // Side A: the subtree at targetNode (branch halved)
  const sideA: TreeNode = {
    name: targetNode.name,
    length: halfLen,
    children: targetNode.children,
  };

  // Side B: the rest of the tree, path from targetParent to old root reversed.
  function invertBranch(node: TreeNode, excludeChild: TreeNode, newLength: number): TreeNode {
    const keptChildren = node.children.filter((c) => c !== excludeChild);
    const parent = parentMap.get(node);
    const newChildren: TreeNode[] = [...keptChildren];
    if (parent) {
      newChildren.push(invertBranch(parent, node, lengthFromParent.get(node) ?? 0));
    }
    return { name: node.name, length: newLength, children: newChildren };
  }

  const sideB = invertBranch(targetParent, targetNode, halfLen);

  return { name: "", length: 0, children: [sideA, sideB] };
}

// ---------------------------------------------------------------------------
// Rotate (reverse children of one node)
// ---------------------------------------------------------------------------

export function rotateNode(root: TreeNode, targetId: string): TreeNode {
  function copy(node: TreeNode, currentId: string): TreeNode {
    const children = node.children.map((c, i) => copy(c, `${currentId}-${i}`));
    if (currentId === targetId) {
      return { name: node.name, length: node.length, children: [...children].reverse() };
    }
    return { name: node.name, length: node.length, children };
  }
  return copy(root, "r");
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
  root: TreeNode,
  yStep: number,
  collapsedNodes: ReadonlySet<string>,
  leafCounts: Map<TreeNode, number>,
): LayoutResult {
  let leafIdx = 0;
  let maxDepth = 0;

  function build(node: TreeNode, depth: number, id: string): LayoutNode {
    const lc = leafCounts.get(node) ?? 1;

    if (collapsedNodes.has(id) || node.children.length === 0) {
      const y = leafIdx++ * yStep;
      if (depth > maxDepth) maxDepth = depth;
      return { node, id, x: depth, y, children: [], leafCount: lc };
    }

    const children = node.children.map((c, i) => build(c, depth + c.length, `${id}-${i}`));
    const y = (children[0].y + children[children.length - 1].y) / 2;

    return { node, id, x: depth, y, children, leafCount: lc };
  }

  const layoutRoot = build(root, 0, "r");
  return { root: layoutRoot, nLeaves: leafIdx, maxDepth };
}

// ---------------------------------------------------------------------------
// Cladogram layout (equal branch lengths, all leaves aligned)
// ---------------------------------------------------------------------------

export function buildCladogramLayout(
  root: TreeNode,
  yStep: number,
  collapsedNodes: ReadonlySet<string>,
  leafCounts: Map<TreeNode, number>,
): LayoutResult {
  // Precompute hops from each node to its farthest descendant leaf.
  const hopMap = new Map<TreeNode, number>();

  function precompute(node: TreeNode): number {
    if (node.children.length === 0) {
      hopMap.set(node, 0);
      return 0;
    }
    const h = 1 + Math.max(...node.children.map(precompute));
    hopMap.set(node, h);
    return h;
  }

  const maxHops = precompute(root);
  let leafIdx = 0;

  function build(node: TreeNode, id: string): LayoutNode {
    const lc = leafCounts.get(node) ?? 1;
    const hops = hopMap.get(node) ?? 0;
    const x = maxHops - hops; // leaves have x = maxHops, root has x = 0

    if (collapsedNodes.has(id) || node.children.length === 0) {
      const y = leafIdx++ * yStep;
      return { node, id, x, y, children: [], leafCount: lc };
    }

    const children = node.children.map((c, i) => build(c, `${id}-${i}`));
    const y = (children[0].y + children[children.length - 1].y) / 2;

    return { node, id, x, y, children, leafCount: lc };
  }

  const layoutRoot = build(root, "r");
  return { root: layoutRoot, nLeaves: leafIdx, maxDepth: maxHops };
}

// ---------------------------------------------------------------------------
// Radial layout
// ---------------------------------------------------------------------------

export function buildRadialLayout(
  root: TreeNode,
  maxRadius: number,
  collapsedNodes: ReadonlySet<string>,
  leafCounts: Map<TreeNode, number>,
): LayoutResult {
  // Compute max cumulative branch depth for radius scaling.
  function maxBranchDepth(node: TreeNode, depth: number): number {
    if (node.children.length === 0) return depth;
    return Math.max(...node.children.map((c) => maxBranchDepth(c, depth + c.length)));
  }
  const maxDepth = maxBranchDepth(root, 0);

  // Count total rendered leaves (respecting collapsed nodes).
  function countVisible(node: TreeNode, id: string): number {
    if (node.children.length === 0 || collapsedNodes.has(id)) return 1;
    return node.children.reduce((s, c, i) => s + countVisible(c, `${id}-${i}`), 0);
  }
  const totalLeaves = countVisible(root, "r");
  const angleStep = (2 * Math.PI) / totalLeaves;

  let leafIdx = 0;

  function build(node: TreeNode, depth: number, id: string): LayoutNode {
    const lc = leafCounts.get(node) ?? 1;
    const r = maxDepth > 0 ? (depth / maxDepth) * maxRadius : 0;

    if (collapsedNodes.has(id) || node.children.length === 0) {
      const angle = leafIdx * angleStep;
      leafIdx++;
      return { node, id, x: r, y: 0, angle, children: [], leafCount: lc };
    }

    const children = node.children.map((c, i) =>
      build(c, depth + c.length, `${id}-${i}`),
    );

    const firstAngle = children[0].angle ?? 0;
    const lastAngle = children[children.length - 1].angle ?? 0;
    const angle = (firstAngle + lastAngle) / 2;

    return { node, id, x: r, y: 0, angle, children, leafCount: lc };
  }

  const layoutRoot = build(root, 0, "r");
  return { root: layoutRoot, nLeaves: leafIdx, maxDepth };
}

// ---------------------------------------------------------------------------
// Layout dispatcher
// ---------------------------------------------------------------------------

export function buildLayout(
  root: TreeNode,
  mode: LayoutMode,
  yStep: number,
  maxRadius: number,
  collapsedNodes: ReadonlySet<string>,
  leafCounts: Map<TreeNode, number>,
): LayoutResult {
  switch (mode) {
    case "rectangular":
      return buildRectLayout(root, yStep, collapsedNodes, leafCounts);
    case "cladogram":
      return buildCladogramLayout(root, yStep, collapsedNodes, leafCounts);
    case "radial":
      return buildRadialLayout(root, maxRadius, collapsedNodes, leafCounts);
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
