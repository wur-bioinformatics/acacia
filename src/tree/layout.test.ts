import { describe, it, expect } from "vitest";
import {
  parseNewick,
  flattenTree,
  rerootFlat,
  rotateFlat,
  rotateFlatToOrder,
  moveSubtreeToSibling,
  buildLayout,
  branchKey,
} from "./layout";

// ---------------------------------------------------------------------------
// parseNewick
// ---------------------------------------------------------------------------

describe("parseNewick", () => {
  it("parses a single leaf", () => {
    const tree = parseNewick("A;");
    expect(tree.name).toBe("A");
    expect(tree.children).toHaveLength(0);
  });

  it("parses branch lengths", () => {
    const tree = parseNewick("(A:0.1,B:0.2)root:0;");
    expect(tree.name).toBe("root");
    expect(tree.children).toHaveLength(2);
    expect(tree.children[0].name).toBe("A");
    expect(tree.children[0].length).toBeCloseTo(0.1);
    expect(tree.children[1].name).toBe("B");
    expect(tree.children[1].length).toBeCloseTo(0.2);
  });

  it("parses nested trees", () => {
    const tree = parseNewick("((A,B),C);");
    expect(tree.children).toHaveLength(2);
    expect(tree.children[0].children).toHaveLength(2);
    expect(tree.children[1].name).toBe("C");
  });

  it("parses bootstrap labels on internal nodes", () => {
    const tree = parseNewick("((A,B)95,C)100;");
    expect(tree.name).toBe("100");
    expect(tree.children[0].name).toBe("95");
  });
});

// ---------------------------------------------------------------------------
// flattenTree
// ---------------------------------------------------------------------------

describe("flattenTree", () => {
  it("assigns unique IDs to all nodes", () => {
    const tree = parseNewick("((A,B),C);");
    const flat = flattenTree(tree);
    expect(flat.nodes.size).toBe(5); // root, internal, A, B, C
  });

  it("records leaves in DFS order", () => {
    const tree = parseNewick("((A,B),C);");
    const flat = flattenTree(tree);
    const leafNames = flat.leafOrder.map((id) => flat.nodes.get(id)!.name);
    expect(leafNames).toEqual(["A", "B", "C"]);
  });

  it("sets isRerooted to false", () => {
    const flat = flattenTree(parseNewick("(A,B);"));
    expect(flat.isRerooted).toBe(false);
    expect(flat.originalRootId).toBe(flat.rootId);
  });

  it("computes leafCounts correctly", () => {
    const tree = parseNewick("((A,B),C);");
    const flat = flattenTree(tree);
    const root = flat.nodes.get(flat.rootId)!;
    expect(root.leafCount).toBe(3);
    const internal = flat.nodes.get(root.childIds[0])!;
    expect(internal.leafCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// rerootFlat
// ---------------------------------------------------------------------------

describe("rerootFlat", () => {
  it("returns unchanged tree when rerooting on root", () => {
    const flat = flattenTree(parseNewick("(A,B);"));
    const result = rerootFlat(flat, flat.rootId);
    expect(result).toBe(flat); // same reference
  });

  it("sets isRerooted to true after rerooting", () => {
    const flat = flattenTree(parseNewick("(A,B,C);"));
    const leafId = flat.leafOrder[0];
    const rerooted = rerootFlat(flat, leafId);
    expect(rerooted.isRerooted).toBe(true);
  });

  it("preserves originalRootId", () => {
    const flat = flattenTree(parseNewick("(A,B);"));
    const originalRoot = flat.rootId;
    const rerooted = rerootFlat(flat, flat.leafOrder[0]);
    expect(rerooted.originalRootId).toBe(originalRoot);
  });

  it("keeps node count constant", () => {
    const flat = flattenTree(parseNewick("((A,B),C);"));
    const rerooted = rerootFlat(flat, flat.leafOrder[0]);
    expect(rerooted.nodes.size).toBe(flat.nodes.size);
  });
});

// ---------------------------------------------------------------------------
// rotateFlat
// ---------------------------------------------------------------------------

describe("rotateFlat", () => {
  it("reverses children of the target node", () => {
    const flat = flattenTree(parseNewick("(A,B,C);"));
    const rootChildsBefore = flat.nodes.get(flat.rootId)!.childIds;
    const rotated = rotateFlat(flat, flat.rootId);
    const rootChildsAfter = rotated.nodes.get(flat.rootId)!.childIds;
    expect(rootChildsAfter).toEqual([...rootChildsBefore].reverse());
  });

  it("returns original tree unchanged for unknown id", () => {
    const flat = flattenTree(parseNewick("(A,B);"));
    const result = rotateFlat(flat, "nonexistent");
    expect(result).toBe(flat);
  });

  it("does not mutate the original tree", () => {
    const flat = flattenTree(parseNewick("(A,B,C);"));
    const originalChildren = [...flat.nodes.get(flat.rootId)!.childIds];
    rotateFlat(flat, flat.rootId);
    expect(flat.nodes.get(flat.rootId)!.childIds).toEqual(originalChildren);
  });
});

// ---------------------------------------------------------------------------
// buildLayout
// ---------------------------------------------------------------------------

describe("buildLayout (rectangular)", () => {
  it("positions leaves at sequential y values", () => {
    const flat = flattenTree(parseNewick("(A,B,C);"));
    const { root } = buildLayout(flat, "rectangular", 20, 100, new Set());
    const leafYs = root.children.map((c) => c.y);
    expect(leafYs).toEqual([0, 20, 40]);
  });

  it("returns correct leaf count", () => {
    const flat = flattenTree(parseNewick("((A,B),C);"));
    const { nLeaves } = buildLayout(flat, "rectangular", 20, 100, new Set());
    expect(nLeaves).toBe(3);
  });

  it("collapses subtrees when id is in collapsedNodes", () => {
    const flat = flattenTree(parseNewick("((A,B),C);"));
    const internalId = flat.nodes.get(flat.rootId)!.childIds[0];
    const { root } = buildLayout(flat, "rectangular", 20, 100, new Set([internalId]));
    const collapsed = root.children.find((c) => c.id === internalId)!;
    expect(collapsed.children).toHaveLength(0); // treated as leaf
  });
});

// ---------------------------------------------------------------------------
// buildLayout (rectangular) — edge cases
// ---------------------------------------------------------------------------

describe("buildLayout (rectangular) edge cases", () => {
  it("handles maxDepth=0 (all zero-length branches) without throwing", () => {
    const flat = flattenTree(parseNewick("(A:0,B:0);"));
    const { maxDepth } = buildLayout(flat, "rectangular", 20, 100, new Set());
    expect(maxDepth).toBe(0);
  });

  it("single-leaf tree positions at y=0", () => {
    const flat = flattenTree(parseNewick("A;"));
    const { root, nLeaves } = buildLayout(flat, "rectangular", 20, 100, new Set());
    expect(nLeaves).toBe(1);
    expect(root.y).toBe(0);
  });

  it("polytomy with 5 children has correct y values", () => {
    const flat = flattenTree(parseNewick("(A,B,C,D,E);"));
    const { nLeaves, root } = buildLayout(flat, "rectangular", 20, 100, new Set());
    expect(nLeaves).toBe(5);
    const leafYs = root.children.map((c) => c.y);
    expect(leafYs).toEqual([0, 20, 40, 60, 80]);
  });
});

// ---------------------------------------------------------------------------
// buildLayout (cladogram)
// ---------------------------------------------------------------------------

describe("buildLayout (cladogram)", () => {
  it("positions all leaves at equal x regardless of branch lengths", () => {
    const flat = flattenTree(parseNewick("(A:1,B:2,C:3);"));
    const { root } = buildLayout(flat, "cladogram", 20, 100, new Set());
    const leafXs = root.children.map((c) => c.x);
    expect(leafXs[0]).toBe(leafXs[1]);
    expect(leafXs[1]).toBe(leafXs[2]);
  });

  it("places root at x=0", () => {
    const flat = flattenTree(parseNewick("(A,B,C);"));
    const { root } = buildLayout(flat, "cladogram", 20, 100, new Set());
    expect(root.x).toBe(0);
  });

  it("maxDepth equals maxHops from root to leaf", () => {
    // ((A,B),C) — root has 2 hops to A or B
    const flat = flattenTree(parseNewick("((A,B),C);"));
    const { maxDepth } = buildLayout(flat, "cladogram", 20, 100, new Set());
    expect(maxDepth).toBe(2);
  });

  it("internal node x equals maxHops minus its hop count", () => {
    const flat = flattenTree(parseNewick("((A,B),C);"));
    const { root } = buildLayout(flat, "cladogram", 20, 100, new Set());
    const internal = root.children.find((c) => c.children.length > 0)!;
    // internal is 1 hop from leaves, maxHops is 2 → x = 2 - 1 = 1
    expect(internal.x).toBe(1);
  });

  it("zero-length branches produce same x layout as varied lengths", () => {
    const flat1 = flattenTree(parseNewick("(A:0,B:0,C:0);"));
    const flat2 = flattenTree(parseNewick("(A:5,B:3,C:1);"));
    const { root: r1 } = buildLayout(flat1, "cladogram", 20, 100, new Set());
    const { root: r2 } = buildLayout(flat2, "cladogram", 20, 100, new Set());
    expect(r1.children.map((c) => c.x)).toEqual(r2.children.map((c) => c.x));
  });

  it("polytomy — all children at same hop distance from root", () => {
    const flat = flattenTree(parseNewick("(A,B,C,D);"));
    const { root } = buildLayout(flat, "cladogram", 20, 100, new Set());
    const leafXs = root.children.map((c) => c.x);
    expect(new Set(leafXs).size).toBe(1);
  });

  it("returns correct leaf count", () => {
    const flat = flattenTree(parseNewick("((A,B),C);"));
    const { nLeaves } = buildLayout(flat, "cladogram", 20, 100, new Set());
    expect(nLeaves).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// buildLayout (radial)
// ---------------------------------------------------------------------------

describe("buildLayout (radial)", () => {
  const TWO_PI = 2 * Math.PI;

  it("root has x=0 (zero radius)", () => {
    const flat = flattenTree(parseNewick("(A:1,B:1);"));
    const { root } = buildLayout(flat, "radial", 20, 100, new Set());
    expect(root.x).toBe(0);
  });

  it("all leaves at radius = maxRadius", () => {
    const flat = flattenTree(parseNewick("(A:1,B:1,C:1);"));
    const { root } = buildLayout(flat, "radial", 20, 100, new Set());
    for (const leaf of root.children) {
      expect(leaf.x).toBeCloseTo(100); // radial x is radius, scaled to maxRadius
    }
  });

  it("assigns angle to every leaf", () => {
    const flat = flattenTree(parseNewick("(A,B,C);"));
    const { root } = buildLayout(flat, "radial", 20, 100, new Set());
    for (const leaf of root.children) {
      expect(leaf.angle).toBeDefined();
    }
  });

  it("leaf angles are evenly spaced at 2π/nLeaves", () => {
    const flat = flattenTree(parseNewick("(A,B,C,D);"));
    const { root } = buildLayout(flat, "radial", 20, 100, new Set());
    const angles = root.children.map((c) => c.angle!);
    const step = TWO_PI / 4;
    for (let i = 1; i < angles.length; i++) {
      expect(angles[i] - angles[i - 1]).toBeCloseTo(step);
    }
  });

  it("internal node angle is between its children angles", () => {
    const flat = flattenTree(parseNewick("((A,B),C);"));
    const { root } = buildLayout(flat, "radial", 20, 100, new Set());
    const internal = root.children.find((c) => c.children.length > 0)!;
    const childAngles = internal.children.map((c) => c.angle!);
    const mid = (childAngles[0] + childAngles[childAngles.length - 1]) / 2;
    expect(internal.angle).toBeCloseTo(mid);
  });

  it("handles single-leaf tree without throwing", () => {
    const flat = flattenTree(parseNewick("A;"));
    const { root, nLeaves } = buildLayout(flat, "radial", 20, 100, new Set());
    expect(nLeaves).toBe(1);
    expect(root.angle).toBeDefined();
  });

  it("collapsed subtree counts as 1 visible leaf for angle spacing", () => {
    const flat = flattenTree(parseNewick("((A,B),C);"));
    const internalId = flat.nodes.get(flat.rootId)!.childIds[0];
    const { nLeaves } = buildLayout(flat, "radial", 20, 100, new Set([internalId]));
    expect(nLeaves).toBe(2); // collapsed (A,B) + C
  });
});

// ---------------------------------------------------------------------------
// rerootFlat — edge cases
// ---------------------------------------------------------------------------

describe("rerootFlat edge cases", () => {
  it("reroot on direct child of root (path.length === 2)", () => {
    const flat = flattenTree(parseNewick("(A,B,C);"));
    const aId = flat.leafOrder[0];
    const rerooted = rerootFlat(flat, aId);
    expect(rerooted.nodes.size).toBe(flat.nodes.size);
    expect(rerooted.isRerooted).toBe(true);
    // All original leaves still present
    const names = rerooted.leafOrder.map((id) => rerooted.nodes.get(id)!.name);
    expect(names).toContain("A");
    expect(names).toContain("B");
    expect(names).toContain("C");
  });

  it("reroot on a direct child of a binary root is a no-op (preserves branch lengths)", () => {
    // Topologically there's nothing to do: rerooting on either child of a binary root
    // gives back the same tree shape. The prior implementation halved the target's
    // branch without compensating the sibling — visibly shortening the branch.
    const flat = flattenTree(parseNewick("((A:1,B:1):2,(C:1,D:1):3);"));
    const topChild = flat.nodes.get(flat.rootId)!.childIds[0]; // length 2
    const bottomChild = flat.nodes.get(flat.rootId)!.childIds[1]; // length 3
    const rerootedTop = rerootFlat(flat, topChild);
    expect(rerootedTop).toBe(flat);
    const rerootedBottom = rerootFlat(flat, bottomChild);
    expect(rerootedBottom).toBe(flat);
  });

  it("preserves total tree length when rerooting on a deep node", () => {
    // The path-reversal loop used to read length from the cloned (already-mutated) parent,
    // and orphan re-homing didn't extend the orphan's edge through the old root. Net effect:
    // total edge length changed silently. This test pins the invariant.
    const totalEdgeLength = (t: ReturnType<typeof flattenTree>): number => {
      let s = 0;
      for (const n of t.nodes.values()) s += n.length;
      return s;
    };
    const flat = flattenTree(parseNewick("(((A:1,B:2):3,C:4):5,D:6);"));
    const before = totalEdgeLength(flat);
    const aId = flat.leafOrder[0];
    const rerooted = rerootFlat(flat, aId);
    expect(totalEdgeLength(rerooted)).toBeCloseTo(before, 10);
  });

  it("preserves pairwise patristic distances when rerooting", () => {
    // Stronger invariant than total length: every leaf-to-leaf distance must match the
    // original. Easy to break with a subtle length bug that happens to balance out in
    // aggregate.
    function patristicDistances(t: ReturnType<typeof flattenTree>): Map<string, number> {
      const adj = new Map<string, Map<string, number>>();
      for (const id of t.nodes.keys()) adj.set(id, new Map());
      for (const [id, node] of t.nodes) {
        if (node.parentId !== null) {
          adj.get(id)!.set(node.parentId, node.length);
          adj.get(node.parentId)!.set(id, node.length);
        }
      }
      const leafIds = [...t.nodes.values()].filter((n) => n.childIds.length === 0).map((n) => n.id);
      const dists = new Map<string, number>();
      for (const a of leafIds) {
        const stack: [string, number][] = [[a, 0]];
        const seen = new Set<string>([a]);
        while (stack.length) {
          const [cur, d] = stack.pop()!;
          for (const [nb, len] of adj.get(cur)!) {
            if (seen.has(nb)) continue;
            seen.add(nb);
            stack.push([nb, d + len]);
          }
        }
        for (const b of leafIds) {
          if (a >= b) continue;
          const nameA = t.nodes.get(a)!.name;
          const nameB = t.nodes.get(b)!.name;
          const key = [nameA, nameB].sort().join("|");
          // Find distance to b — rebuild by walking again, simpler: BFS above didn't track.
          // Recompute via fresh DFS:
          let dToB = NaN;
          const stack2: [string, number][] = [[a, 0]];
          const seen2 = new Set<string>([a]);
          while (stack2.length) {
            const [cur, d] = stack2.pop()!;
            if (cur === b) { dToB = d; break; }
            for (const [nb, len] of adj.get(cur)!) {
              if (seen2.has(nb)) continue;
              seen2.add(nb);
              stack2.push([nb, d + len]);
            }
          }
          dists.set(key, dToB);
        }
      }
      return dists;
    }
    const flat = flattenTree(parseNewick("(((A:1,B:2):3,C:4):5,D:6);"));
    const before = patristicDistances(flat);
    const aId = flat.leafOrder[0];
    const rerooted = rerootFlat(flat, aId);
    const after = patristicDistances(rerooted);
    expect([...after.keys()].sort()).toEqual([...before.keys()].sort());
    for (const [k, v] of before) expect(after.get(k)!).toBeCloseTo(v, 10);
  });

  it("reroot on deeply nested leaf", () => {
    const flat = flattenTree(parseNewick("((((A,B),C),D),E);"));
    const aId = flat.leafOrder[0];
    const rerooted = rerootFlat(flat, aId);
    expect(rerooted.nodes.size).toBe(flat.nodes.size);
    const names = rerooted.leafOrder.map((id) => rerooted.nodes.get(id)!.name);
    expect(names).toHaveLength(5);
    expect(names).toContain("A");
  });

  it("reroot on zero-length branch sets both halves to 0", () => {
    const flat = flattenTree(parseNewick("(A:0,B:1,C:2);"));
    const aId = flat.leafOrder[0];
    const rerooted = rerootFlat(flat, aId);
    const aNode = rerooted.nodes.get(aId)!;
    expect(aNode.length).toBe(0);
  });

  it("all leaves preserved after double reroot", () => {
    const flat = flattenTree(parseNewick("((A,B),C);"));
    const bId = flat.leafOrder[1];
    const once = rerootFlat(flat, bId);
    const cId = once.leafOrder.find((id) => once.nodes.get(id)!.name === "C")!;
    const twice = rerootFlat(once, cId);
    expect(twice.nodes.size).toBe(flat.nodes.size);
    const names = twice.leafOrder.map((id) => twice.nodes.get(id)!.name);
    expect(names).toHaveLength(3);
    expect(names).toContain("A");
    expect(names).toContain("B");
    expect(names).toContain("C");
  });

  it("leaf counts are consistent after reroot", () => {
    const flat = flattenTree(parseNewick("((A,B),(C,D));"));
    const aId = flat.leafOrder[0];
    const rerooted = rerootFlat(flat, aId);
    const rootNode = rerooted.nodes.get(rerooted.rootId)!;
    expect(rootNode.leafCount).toBe(4);
  });

  it("every node has a valid parentId or is the root", () => {
    const flat = flattenTree(parseNewick("((A,B),(C,(D,E)));"));
    const leafId = flat.leafOrder[3]; // D
    const rerooted = rerootFlat(flat, leafId);
    for (const [id, node] of rerooted.nodes) {
      if (id === rerooted.rootId) {
        expect(node.parentId).toBeNull();
      } else {
        expect(node.parentId).not.toBeNull();
        expect(rerooted.nodes.has(node.parentId!)).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// rotateFlatToOrder
// ---------------------------------------------------------------------------

describe("rotateFlatToOrder", () => {
  function leafNames(tree: ReturnType<typeof flattenTree>): string[] {
    return tree.leafOrder.map((id) => tree.nodes.get(id)!.name);
  }

  it("preserves all leaves and only reorders them", () => {
    const tree = flattenTree(parseNewick("((A,B),(C,D));"));
    const result = rotateFlatToOrder(tree, ["B", "A", "D", "C"]);
    expect(new Set(leafNames(result))).toEqual(new Set(["A", "B", "C", "D"]));
    expect(result.nodes.size).toBe(tree.nodes.size);
  });

  it("returns same leafOrder when desiredLeafNames matches current order", () => {
    const tree = flattenTree(parseNewick("((A,B),(C,D));"));
    const result = rotateFlatToOrder(tree, ["A", "B", "C", "D"]);
    expect(leafNames(result)).toEqual(["A", "B", "C", "D"]);
  });

  it("rotates internal-node children to match a non-trivial desired order", () => {
    const tree = flattenTree(parseNewick("((A,B),(C,D));"));
    const result = rotateFlatToOrder(tree, ["B", "A", "D", "C"]);
    expect(leafNames(result)).toEqual(["B", "A", "D", "C"]);
  });

  it("recursively rotates multiple internal nodes", () => {
    const tree = flattenTree(parseNewick("((A,B),(C,(D,E)));"));
    const result = rotateFlatToOrder(tree, ["E", "D", "C", "B", "A"]);
    expect(leafNames(result)).toEqual(["E", "D", "C", "B", "A"]);
  });

  it("can swap entire sibling subtrees", () => {
    const tree = flattenTree(parseNewick("((A,B),(C,D));"));
    const result = rotateFlatToOrder(tree, ["C", "D", "A", "B"]);
    expect(leafNames(result)).toEqual(["C", "D", "A", "B"]);
  });

  it("treats leaves not in desiredLeafNames as Infinity (placed last)", () => {
    // Documented behavior: pos.get(name) ?? Infinity. Unknown leaves sort last.
    const tree = flattenTree(parseNewick("(A,B,C);"));
    const result = rotateFlatToOrder(tree, ["C", "A"]); // B is missing
    expect(leafNames(result)).toEqual(["C", "A", "B"]);
  });

  it("does not mutate the original tree", () => {
    const tree = flattenTree(parseNewick("((A,B),(C,D));"));
    const originalOrder = leafNames(tree);
    rotateFlatToOrder(tree, ["B", "A", "D", "C"]);
    expect(leafNames(tree)).toEqual(originalOrder);
  });

  it("preserves stable node IDs (no remapping)", () => {
    const tree = flattenTree(parseNewick("((A,B),(C,D));"));
    const ids = new Set(tree.nodes.keys());
    const result = rotateFlatToOrder(tree, ["B", "A", "D", "C"]);
    expect(new Set(result.nodes.keys())).toEqual(ids);
  });

  it("preserves originalRootId and isRerooted flags", () => {
    const tree = flattenTree(parseNewick("((A,B),C);"));
    const result = rotateFlatToOrder(tree, ["B", "A", "C"]);
    expect(result.originalRootId).toBe(tree.originalRootId);
    expect(result.isRerooted).toBe(tree.isRerooted);
  });
});

// ---------------------------------------------------------------------------
// moveSubtreeToSibling — SPR
// ---------------------------------------------------------------------------

describe("moveSubtreeToSibling", () => {
  function leafNames(tree: ReturnType<typeof flattenTree>): string[] {
    return tree.leafOrder.map((id) => tree.nodes.get(id)!.name);
  }

  function findNodeIdByLeaves(
    tree: ReturnType<typeof flattenTree>,
    names: string[],
  ): string {
    for (const [id] of tree.nodes) {
      const ls: string[] = [];
      function walk(nid: string) {
        const n = tree.nodes.get(nid)!;
        if (n.childIds.length === 0) ls.push(n.name);
        else n.childIds.forEach(walk);
      }
      walk(id);
      if (ls.length === names.length && ls.every((n, i) => n === names[i])) return id;
    }
    throw new Error(`No node with leaves ${names.join(",")}`);
  }

  it("returns null when moving the root", () => {
    const tree = flattenTree(parseNewick("(A,B);"));
    const result = moveSubtreeToSibling(tree, tree.rootId, tree.leafOrder[0], true);
    expect(result).toBeNull();
  });

  it("returns null when target is in moved's subtree (cycle)", () => {
    const tree = flattenTree(parseNewick("((A,B),C);"));
    const internalAB = findNodeIdByLeaves(tree, ["A", "B"]);
    const aId = tree.leafOrder[0];
    const result = moveSubtreeToSibling(tree, internalAB, aId, true);
    expect(result).toBeNull();
  });

  it("returns null when moving onto itself", () => {
    const tree = flattenTree(parseNewick("(A,B,C);"));
    const result = moveSubtreeToSibling(tree, tree.leafOrder[0], tree.leafOrder[0], true);
    expect(result).toBeNull();
  });

  it("sibling reorder preserves topology (no collapse)", () => {
    // ((A,B),C): drag (A,B) to be after C — both children of root, just sibling reorder.
    const tree = flattenTree(parseNewick("((A,B),C);"));
    const sizeBefore = tree.nodes.size;
    const internalAB = findNodeIdByLeaves(tree, ["A", "B"]);
    const cId = findNodeIdByLeaves(tree, ["C"]);
    const result = moveSubtreeToSibling(tree, internalAB, cId, true)!;
    expect(result).not.toBeNull();
    expect(result.nodes.size).toBe(sizeBefore); // no collapse
    expect(leafNames(result)).toEqual(["C", "A", "B"]);
  });

  it("sibling reorder of two leaves reverses their order", () => {
    const tree = flattenTree(parseNewick("(A,B,C);"));
    const aId = findNodeIdByLeaves(tree, ["A"]);
    const cId = findNodeIdByLeaves(tree, ["C"]);
    const result = moveSubtreeToSibling(tree, aId, cId, true)!;
    expect(leafNames(result)).toEqual(["B", "C", "A"]);
  });

  it("collapses degree-2 parent on cross-subtree move (binary tree)", () => {
    // ((A,B),(C,D)): moving (A,B) to sister-of D collapses old root's left child path.
    // Detail: moving internal (A,B) makes root's other child (C,D) the only child.
    // root is preserved (degree-1 root allowed). New (A,B) attaches as sibling of D under (C,D).
    const tree = flattenTree(parseNewick("((A,B),(C,D));"));
    const internalAB = findNodeIdByLeaves(tree, ["A", "B"]);
    const dId = findNodeIdByLeaves(tree, ["D"]);
    const result = moveSubtreeToSibling(tree, internalAB, dId, true)!;
    expect(result).not.toBeNull();
    expect(leafNames(result)).toEqual(["C", "D", "A", "B"]);
  });

  it("preserves NodeId stability — no remapping", () => {
    const tree = flattenTree(parseNewick("((A,B),(C,D));"));
    const internalAB = findNodeIdByLeaves(tree, ["A", "B"]);
    const dId = findNodeIdByLeaves(tree, ["D"]);
    const result = moveSubtreeToSibling(tree, internalAB, dId, true)!;
    expect(result.nodes.has(internalAB)).toBe(true);
    expect(result.nodes.has(dId)).toBe(true);
  });

  it("preserves originalRootId and isRerooted flags", () => {
    const tree = flattenTree(parseNewick("((A,B),(C,D));"));
    const internalAB = findNodeIdByLeaves(tree, ["A", "B"]);
    const dId = findNodeIdByLeaves(tree, ["D"]);
    const result = moveSubtreeToSibling(tree, internalAB, dId, true)!;
    expect(result.originalRootId).toBe(tree.originalRootId);
    expect(result.isRerooted).toBe(tree.isRerooted);
  });

  it("recomputes leafCounts correctly", () => {
    // After moving (A,B) under (C,D): root has 1 child (C,D), (C,D) now has 3 children.
    const tree = flattenTree(parseNewick("((A,B),(C,D));"));
    const internalAB = findNodeIdByLeaves(tree, ["A", "B"]);
    const dId = findNodeIdByLeaves(tree, ["D"]);
    const result = moveSubtreeToSibling(tree, internalAB, dId, true)!;
    const root = result.nodes.get(result.rootId)!;
    expect(root.leafCount).toBe(4);
  });

  it("does not mutate the original tree", () => {
    const tree = flattenTree(parseNewick("((A,B),(C,D));"));
    const before = leafNames(tree);
    const internalAB = findNodeIdByLeaves(tree, ["A", "B"]);
    const dId = findNodeIdByLeaves(tree, ["D"]);
    moveSubtreeToSibling(tree, internalAB, dId, true);
    expect(leafNames(tree)).toEqual(before);
  });

  it("insertAfter=false places moved BEFORE target", () => {
    const tree = flattenTree(parseNewick("(A,B,C,D);"));
    const dId = findNodeIdByLeaves(tree, ["D"]);
    const bId = findNodeIdByLeaves(tree, ["B"]);
    const result = moveSubtreeToSibling(tree, dId, bId, false)!;
    expect(leafNames(result)).toEqual(["A", "D", "B", "C"]);
  });

  it("complex SPR: (((A,B),C),D) — drag (A,B) to be after D", () => {
    // Old: root → ((((A,B),C)) D). Old grouping ((A,B),C) collapses when (A,B) is detached
    // (since the (A,B) parent kept only C → C absorbs the parent and attaches to root).
    const tree = flattenTree(parseNewick("(((A,B),C),D);"));
    const internalAB = findNodeIdByLeaves(tree, ["A", "B"]);
    const dId = findNodeIdByLeaves(tree, ["D"]);
    const result = moveSubtreeToSibling(tree, internalAB, dId, true)!;
    expect(leafNames(result)).toEqual(["C", "D", "A", "B"]);
    // Old grouping (A,B)+C internal node is gone (collapsed).
    expect(result.nodes.size).toBe(tree.nodes.size - 1);
  });
});

// ---------------------------------------------------------------------------
// branchKey
// ---------------------------------------------------------------------------

describe("branchKey", () => {
  it("uses leaf name for leaf nodes", () => {
    const flat = flattenTree(parseNewick("(A,B);"));
    const { root } = buildLayout(flat, "rectangular", 20, 100, new Set());
    const leafNode = root.children[0];
    expect(branchKey(leafNode)).toBe(`branch:leaf:${leafNode.name}`);
  });

  it("uses node id for internal nodes", () => {
    const flat = flattenTree(parseNewick("((A,B),C);"));
    const { root } = buildLayout(flat, "rectangular", 20, 100, new Set());
    expect(branchKey(root)).toBe(`branch:${root.id}`);
  });
});
