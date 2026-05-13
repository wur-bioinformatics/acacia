import { describe, it, expect } from "vitest";
import { flattenTree, parseNewick } from "../layout";
import type { FlatTree, NodeId } from "../types";
import { midpointRoot } from "./midpoint";

function makeTree(newick: string): FlatTree {
  return flattenTree(parseNewick(newick));
}

function patristic(tree: FlatTree, from: NodeId): Map<NodeId, number> {
  const adj = new Map<NodeId, Map<NodeId, number>>();
  for (const id of tree.nodes.keys()) adj.set(id, new Map());
  for (const [id, node] of tree.nodes) {
    if (node.parentId !== null) {
      adj.get(id)!.set(node.parentId, node.length);
      adj.get(node.parentId)!.set(id, node.length);
    }
  }
  const dist = new Map<NodeId, number>();
  dist.set(from, 0);
  const stack: NodeId[] = [from];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const [n, len] of adj.get(cur)!) {
      if (!dist.has(n)) {
        dist.set(n, dist.get(cur)! + len);
        stack.push(n);
      }
    }
  }
  return dist;
}

function leafIdByName(tree: FlatTree, name: string): NodeId {
  for (const [id, node] of tree.nodes) if (node.name === name) return id;
  throw new Error(`leaf ${name} not found`);
}

function rootToLeafDistances(tree: FlatTree): Map<string, number> {
  const out = new Map<string, number>();
  function walk(id: NodeId, depth: number) {
    const node = tree.nodes.get(id)!;
    const d = depth + (id === tree.rootId ? 0 : node.length);
    if (node.childIds.length === 0) out.set(node.name, d);
    else for (const c of node.childIds) walk(c, d);
  }
  walk(tree.rootId, 0);
  return out;
}

describe("midpointRoot", () => {
  it("places root at the midpoint of the diameter", () => {
    // (A:1, B:5) — diameter A-B = 6, midpoint at 3 from each leaf.
    const tree = makeTree("(A:1, B:5);");
    const result = midpointRoot(tree);
    const dists = rootToLeafDistances(result);
    expect(dists.get("A")).toBeCloseTo(3);
    expect(dists.get("B")).toBeCloseTo(3);
  });

  it("makes both diameter-endpoint leaves equidistant from the new root", () => {
    // Diameter A-D = 1 + 2 + 2 + 5 = 10, midpoint at 5 from each.
    const tree = makeTree("((A:1, B:1):2, (C:1, D:5):2);");
    const result = midpointRoot(tree);
    const dists = rootToLeafDistances(result);
    const sorted = [...dists.values()].sort((a, b) => b - a);
    expect(sorted[0]).toBeCloseTo(sorted[1]);
  });

  it("preserves total patristic distance between every pair of leaves", () => {
    const tree = makeTree("((A:1.5, B:2):0.5, (C:3, (D:1, E:2):1.2):0.7);");
    const result = midpointRoot(tree);

    const leaves = ["A", "B", "C", "D", "E"];
    for (const a of leaves) {
      const before = patristic(tree, leafIdByName(tree, a));
      const after = patristic(result, leafIdByName(result, a));
      for (const b of leaves) {
        if (a === b) continue;
        expect(after.get(leafIdByName(result, b))!).toBeCloseTo(
          before.get(leafIdByName(tree, b))!,
        );
      }
    }
  });

  it("gives the same root-to-leaf distances across different Newick rootings of the same unrooted tree", () => {
    // All four strings encode the same unrooted topology. The binary root,
    // degree-2 internal nodes, and sibling-order are arbitrary; midpoint
    // rooting must converge to the same metric in all four cases.
    const variants = [
      "((A:1, B:1):2, (C:1, D:5):2);",
      "((B:1, A:1):2, (D:5, C:1):2);",
      "(A:1, B:1, (C:1, D:5):4);", // collapse the binary root → X as a degree-3 root
      "(D:5, C:1, (A:1, B:1):4);", // same as above with reversed sibling order
    ];
    const baseline = rootToLeafDistances(midpointRoot(makeTree(variants[0])));
    for (let i = 1; i < variants.length; i++) {
      const dists = rootToLeafDistances(midpointRoot(makeTree(variants[i])));
      for (const [leaf, d] of baseline) {
        expect(dists.get(leaf)!).toBeCloseTo(d);
      }
    }
  });

  it("rooting-invariance on a deeper asymmetric tree", () => {
    const variants = [
      "(((A:0.5, B:0.7):0.3, C:1.1):0.6, ((D:0.4, E:0.9):0.2, F:1.3):0.5);",
      "(((B:0.7, A:0.5):0.3, C:1.1):0.6, ((E:0.9, D:0.4):0.2, F:1.3):0.5);",
      "((A:0.5, B:0.7):0.3, C:1.1, ((D:0.4, E:0.9):0.2, F:1.3):1.1);", // collapse top binary
    ];
    const baseline = rootToLeafDistances(midpointRoot(makeTree(variants[0])));
    for (let i = 1; i < variants.length; i++) {
      const dists = rootToLeafDistances(midpointRoot(makeTree(variants[i])));
      for (const [leaf, d] of baseline) {
        expect(dists.get(leaf)!).toBeCloseTo(d);
      }
    }
  });

  it("idempotent — running midpoint twice yields the same metric", () => {
    const tree = makeTree("(((A:1, B:2):1, C:3):1, (D:4, E:1):2);");
    const once = midpointRoot(tree);
    const twice = midpointRoot(once);
    const d1 = rootToLeafDistances(once);
    const d2 = rootToLeafDistances(twice);
    for (const [leaf, d] of d1) {
      expect(d2.get(leaf)!).toBeCloseTo(d);
    }
  });

  it("preserves leaf names and counts", () => {
    const tree = makeTree("((A:1, B:1):2, (C:1, D:5):2);");
    const result = midpointRoot(tree);
    const before = new Set(tree.leafOrder.map((id) => tree.nodes.get(id)!.name));
    const after = new Set(result.leafOrder.map((id) => result.nodes.get(id)!.name));
    expect(after).toEqual(before);
  });

  it("preserves originalRootId and sets isRerooted", () => {
    const tree = makeTree("((A:1, B:1):2, (C:1, D:5):2);");
    const result = midpointRoot(tree);
    expect(result.originalRootId).toBe(tree.originalRootId);
    expect(result.isRerooted).toBe(true);
  });

  it("returns a binary virtual root for typical inputs", () => {
    const tree = makeTree("((A:1, B:1):2, (C:1, D:5):2);");
    const result = midpointRoot(tree);
    expect(result.nodes.get(result.rootId)!.childIds).toHaveLength(2);
  });

  it("returns the input unchanged when there are fewer than 2 leaves", () => {
    const tree = makeTree("A;");
    const result = midpointRoot(tree);
    expect(result).toBe(tree);
  });

  it("returns the input unchanged when all branch lengths are zero", () => {
    const tree = makeTree("((A:0, B:0):0, C:0);");
    const result = midpointRoot(tree);
    expect(result).toBe(tree);
  });

  it("does not mutate the input tree", () => {
    const tree = makeTree("((A:1, B:1):2, (C:1, D:5):2);");
    const before = new Map<NodeId, { parentId: NodeId | null; childIds: NodeId[]; length: number }>();
    for (const [id, n] of tree.nodes) {
      before.set(id, { parentId: n.parentId, childIds: [...n.childIds], length: n.length });
    }
    midpointRoot(tree);
    for (const [id, n] of tree.nodes) {
      const b = before.get(id)!;
      expect(n.parentId).toBe(b.parentId);
      expect(n.childIds).toEqual(b.childIds);
      expect(n.length).toBe(b.length);
    }
  });
});
