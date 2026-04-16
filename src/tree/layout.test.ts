import { describe, it, expect } from "vitest";
import {
  parseNewick,
  flattenTree,
  rerootFlat,
  rotateFlat,
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
// branchKey
// ---------------------------------------------------------------------------

describe("branchKey", () => {
  it("uses leaf name for leaf nodes", () => {
    const flat = flattenTree(parseNewick("(A,B);"));
    const { root } = buildLayout(flat, "rectangular", 20, 100, new Set());
    const leafNode = root.children[0];
    expect(branchKey(leafNode)).toBe(`branch:leaf:${leafNode.node.name}`);
  });

  it("uses node id for internal nodes", () => {
    const flat = flattenTree(parseNewick("((A,B),C);"));
    const { root } = buildLayout(flat, "rectangular", 20, 100, new Set());
    expect(branchKey(root)).toBe(`branch:${root.id}`);
  });
});
