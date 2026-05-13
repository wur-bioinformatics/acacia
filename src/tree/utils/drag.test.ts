import { describe, it, expect } from "vitest";
import { buildLayout, flattenTree, parseNewick } from "../layout";
import type { FlatTree, LayoutNode, NodeId } from "../types";
import { collectVisible, getAllLeafNames, planLeafReorder } from "./drag";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeTree(newick: string): FlatTree {
  return flattenTree(parseNewick(newick));
}

function visibleRowsOf(tree: FlatTree, collapsed: ReadonlySet<NodeId> = new Set()): LayoutNode[] {
  const { root } = buildLayout(tree, "rectangular", 22, 100, collapsed);
  return collectVisible(root, collapsed);
}

function leafNamesOf(tree: FlatTree): string[] {
  return tree.leafOrder.map((id) => tree.nodes.get(id)!.name);
}

function rowIndexOfLeaf(rows: LayoutNode[], name: string): number {
  return rows.findIndex((r) => r.name === name);
}

// Find the node whose descendant-leaf list (in tree order) matches the given names.
// Used in tests to convert from "leaves I want to drag" to the corresponding node id.
function nodeIdForLeaves(tree: FlatTree, leafNames: string[]): NodeId {
  for (const [id] of tree.nodes) {
    const ls = getAllLeafNames(id, tree.nodes);
    if (ls.length === leafNames.length && ls.every((n, i) => n === leafNames[i])) return id;
  }
  throw new Error(`No single-subtree node has leaves [${leafNames.join(",")}] in order`);
}

// ---------------------------------------------------------------------------
// planLeafReorder — single-leaf drags
// ---------------------------------------------------------------------------

describe("planLeafReorder — single-leaf drags", () => {
  it("moves a single leaf down", () => {
    const tree = makeTree("(A,B,C,D);");
    const rows = visibleRowsOf(tree);
    const result = planLeafReorder({
      flatTree: tree,
      visibleRows: rows,
      draggedNodeId: nodeIdForLeaves(tree, ["A"]),
      toRowIndex: rowIndexOfLeaf(rows, "C"),
    });
    expect(result?.newLeafOrder).toEqual(["B", "C", "A", "D"]);
    expect(result?.insertAfter).toBe(true);
  });

  it("moves a single leaf up", () => {
    const tree = makeTree("(A,B,C,D);");
    const rows = visibleRowsOf(tree);
    const result = planLeafReorder({
      flatTree: tree,
      visibleRows: rows,
      draggedNodeId: nodeIdForLeaves(tree, ["D"]),
      toRowIndex: rowIndexOfLeaf(rows, "B"),
    });
    expect(result?.newLeafOrder).toEqual(["A", "D", "B", "C"]);
    expect(result?.insertAfter).toBe(false);
  });

  it("drags first leaf to last position", () => {
    const tree = makeTree("(A,B,C,D);");
    const rows = visibleRowsOf(tree);
    const result = planLeafReorder({
      flatTree: tree,
      visibleRows: rows,
      draggedNodeId: nodeIdForLeaves(tree, ["A"]),
      toRowIndex: rowIndexOfLeaf(rows, "D"),
    });
    expect(result?.newLeafOrder).toEqual(["B", "C", "D", "A"]);
  });

  it("drags last leaf to first position", () => {
    const tree = makeTree("(A,B,C,D);");
    const rows = visibleRowsOf(tree);
    const result = planLeafReorder({
      flatTree: tree,
      visibleRows: rows,
      draggedNodeId: nodeIdForLeaves(tree, ["D"]),
      toRowIndex: rowIndexOfLeaf(rows, "A"),
    });
    expect(result?.newLeafOrder).toEqual(["D", "A", "B", "C"]);
  });

  it("returns null when dropping the leaf onto itself", () => {
    const tree = makeTree("(A,B,C);");
    const rows = visibleRowsOf(tree);
    const result = planLeafReorder({
      flatTree: tree,
      visibleRows: rows,
      draggedNodeId: nodeIdForLeaves(tree, ["B"]),
      toRowIndex: rowIndexOfLeaf(rows, "B"),
    });
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// planLeafReorder — internal-node group drags (the bug-2 scenarios)
// ---------------------------------------------------------------------------

describe("planLeafReorder — internal-node group drags", () => {
  it("dragging the (A,B) clade DOWN past (C,D) reorders to [C,D,A,B]", () => {
    const tree = makeTree("((A,B),(C,D));");
    const rows = visibleRowsOf(tree);
    const result = planLeafReorder({
      flatTree: tree,
      visibleRows: rows,
      draggedNodeId: nodeIdForLeaves(tree, ["A", "B"]),
      toRowIndex: rowIndexOfLeaf(rows, "D"),
    });
    expect(result?.newLeafOrder).toEqual(["C", "D", "A", "B"]);
  });

  it("dragging the (C,D) clade UP past (A,B) reorders to [C,D,A,B] — the bug-2 mirror", () => {
    const tree = makeTree("((A,B),(C,D));");
    const rows = visibleRowsOf(tree);
    const result = planLeafReorder({
      flatTree: tree,
      visibleRows: rows,
      draggedNodeId: nodeIdForLeaves(tree, ["C", "D"]),
      toRowIndex: rowIndexOfLeaf(rows, "A"),
    });
    expect(result?.newLeafOrder).toEqual(["C", "D", "A", "B"]);
  });

  it("dragging a middle internal-node group DOWN past a sibling leaf works", () => {
    const tree = makeTree("(A,(B,C),D);");
    const rows = visibleRowsOf(tree);
    const result = planLeafReorder({
      flatTree: tree,
      visibleRows: rows,
      draggedNodeId: nodeIdForLeaves(tree, ["B", "C"]),
      toRowIndex: rowIndexOfLeaf(rows, "D"),
    });
    expect(result?.newLeafOrder).toEqual(["A", "D", "B", "C"]);
  });

  it("dragging a middle internal-node group UP past a sibling leaf works", () => {
    const tree = makeTree("(A,(B,C),D);");
    const rows = visibleRowsOf(tree);
    const result = planLeafReorder({
      flatTree: tree,
      visibleRows: rows,
      draggedNodeId: nodeIdForLeaves(tree, ["B", "C"]),
      toRowIndex: rowIndexOfLeaf(rows, "A"),
    });
    expect(result?.newLeafOrder).toEqual(["B", "C", "A", "D"]);
  });

  it("preserves intra-group order when dragging a 3-leaf group", () => {
    const tree = makeTree("(A,(B,C,D),E,F);");
    const rows = visibleRowsOf(tree);
    const result = planLeafReorder({
      flatTree: tree,
      visibleRows: rows,
      draggedNodeId: nodeIdForLeaves(tree, ["B", "C", "D"]),
      toRowIndex: rowIndexOfLeaf(rows, "F"),
    });
    expect(result?.newLeafOrder).toEqual(["A", "E", "F", "B", "C", "D"]);
  });
});

// ---------------------------------------------------------------------------
// planLeafReorder — edge cases
// ---------------------------------------------------------------------------

describe("planLeafReorder — edge cases", () => {
  it("returns null when the target row falls inside the dragged group's vertical extent", () => {
    const tree = makeTree("(A,(B,C,D),E);");
    const rows = visibleRowsOf(tree);
    const result = planLeafReorder({
      flatTree: tree,
      visibleRows: rows,
      draggedNodeId: nodeIdForLeaves(tree, ["B", "C", "D"]),
      toRowIndex: rowIndexOfLeaf(rows, "C"),
    });
    expect(result).toBeNull();
  });

  it("returns null when the dragged group is at the top and target is the first row of the group", () => {
    const tree = makeTree("((A,B),C,D);");
    const rows = visibleRowsOf(tree);
    const result = planLeafReorder({
      flatTree: tree,
      visibleRows: rows,
      draggedNodeId: nodeIdForLeaves(tree, ["A", "B"]),
      toRowIndex: rowIndexOfLeaf(rows, "A"),
    });
    expect(result).toBeNull();
  });

  it("returns null when the dragged group is at the bottom and target is the last row of the group", () => {
    const tree = makeTree("(A,B,(C,D));");
    const rows = visibleRowsOf(tree);
    const result = planLeafReorder({
      flatTree: tree,
      visibleRows: rows,
      draggedNodeId: nodeIdForLeaves(tree, ["C", "D"]),
      toRowIndex: rowIndexOfLeaf(rows, "D"),
    });
    expect(result).toBeNull();
  });

  it("clamps a negative toRowIndex to row 0", () => {
    const tree = makeTree("(A,B,C,D);");
    const rows = visibleRowsOf(tree);
    const result = planLeafReorder({
      flatTree: tree,
      visibleRows: rows,
      draggedNodeId: nodeIdForLeaves(tree, ["C"]),
      toRowIndex: -10,
    });
    expect(result?.newLeafOrder).toEqual(["C", "A", "B", "D"]);
  });

  it("clamps an out-of-range toRowIndex to the last row", () => {
    const tree = makeTree("(A,B,C,D);");
    const rows = visibleRowsOf(tree);
    const result = planLeafReorder({
      flatTree: tree,
      visibleRows: rows,
      draggedNodeId: nodeIdForLeaves(tree, ["B"]),
      toRowIndex: 9999,
    });
    expect(result?.newLeafOrder).toEqual(["A", "C", "D", "B"]);
  });

  it("returns null when visibleRows is empty", () => {
    const tree = makeTree("(A,B,C);");
    const result = planLeafReorder({
      flatTree: tree,
      visibleRows: [],
      draggedNodeId: nodeIdForLeaves(tree, ["A"]),
      toRowIndex: 0,
    });
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// planLeafReorder — collapsed-clade rows
// ---------------------------------------------------------------------------

describe("planLeafReorder — with collapsed clades", () => {
  it("treats a collapsed clade as a single visible row whose subtree's leaves are all anchors", () => {
    const tree = makeTree("(A,(B,C),D);");
    const internalId = tree.nodes.get(tree.rootId)!.childIds[1]; // (B,C) parent
    const collapsed = new Set<NodeId>([internalId]);
    const rows = visibleRowsOf(tree, collapsed);
    expect(rows).toHaveLength(3);

    const result = planLeafReorder({
      flatTree: tree,
      visibleRows: rows,
      draggedNodeId: nodeIdForLeaves(tree, ["A"]),
      toRowIndex: 1, // the collapsed (B,C) row
    });
    expect(result?.newLeafOrder).toEqual(["B", "C", "A", "D"]);
  });
});

// ---------------------------------------------------------------------------
// planLeafReorder — invariants over a tree corpus
// ---------------------------------------------------------------------------

describe("planLeafReorder — invariants", () => {
  const corpus = [
    "(A,B);",
    "(A,B,C,D);",
    "((A,B),(C,D));",
    "(((A,B),C),(D,E));",
    "(A,(B,C),(D,(E,F)));",
  ];

  for (const newick of corpus) {
    const tree = makeTree(newick);
    const rows = visibleRowsOf(tree);
    const allLeafNames = leafNamesOf(tree);

    // Candidate drag groups: every non-root node, identified by its set of descendant leaves.
    const candidates: { description: string; nodeId: NodeId; leaves: string[] }[] = [];
    for (const [id, node] of tree.nodes) {
      if (node.id === tree.rootId) continue;
      const leaves = getAllLeafNames(id, tree.nodes);
      if (leaves.length === 0) continue;
      candidates.push({
        description: leaves.length === 1 ? `leaf ${leaves[0]}` : `clade [${leaves.join(",")}]`,
        nodeId: id,
        leaves,
      });
    }

    for (const { description, nodeId, leaves } of candidates) {
      for (let toRow = 0; toRow < rows.length; toRow++) {
        it(`${newick} drag ${description} to row ${toRow} preserves invariants`, () => {
          const plan = planLeafReorder({
            flatTree: tree,
            visibleRows: rows,
            draggedNodeId: nodeId,
            toRowIndex: toRow,
          });
          if (plan === null) return;
          const result = plan.newLeafOrder;

          expect(result).toHaveLength(allLeafNames.length);
          expect(new Set(result)).toEqual(new Set(allLeafNames));

          // Dragged group is contiguous and in original intra-order.
          const firstIdx = result.indexOf(leaves[0]);
          for (let k = 0; k < leaves.length; k++) {
            expect(result[firstIdx + k]).toBe(leaves[k]);
          }

          expect(result.join(",")).not.toBe(allLeafNames.join(","));
        });
      }
    }
  }
});
