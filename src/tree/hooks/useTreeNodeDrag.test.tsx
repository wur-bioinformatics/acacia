import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import Tree from "../index";
import { useTreeStore } from "../treeStore";
import { useNJStore } from "../../NJ/njStore";
import { useSequenceStore } from "../../sequenceStore";
import { flattenTree, parseNewick } from "../layout";
import { MARGIN } from "../constants";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const Y_STEP = 22;
const SVG_TOP = 0; // we stub getBoundingClientRect to start at (0, 0)

function seedTree(newick: string) {
  const ft = flattenTree(parseNewick(newick));
  useTreeStore.setState({
    flatTree: ft,
    previewFlatTree: null,
    layoutMode: "rectangular",
    yStep: Y_STEP,
    xZoom: 1,
    collapsedNodes: new Set(),
    nodeStyles: new Map(),
    branchStyles: new Map(),
    selectedNodeId: null,
    dragEnabled: true,
    nodeRadius: 3,
    branchWidth: 1,
    labelFontSize: 12,
  });
  // Newick effect in <Tree /> reads useNJStore.newick — keep it null so the effect doesn't
  // overwrite our seeded flatTree. status="done" suppresses the loading/error placeholders.
  useNJStore.setState({
    newick: null,
    status: "done",
    error: null,
    isStale: false,
  });
  useSequenceStore.setState({
    order: ft.leafOrder.map((id) => ft.nodes.get(id)!.name),
    selectedIdentifier: null,
    unmatchedLeafNames: [],
  });
  return ft;
}

// Stub SVG geometry so e.clientY ↔ row mapping is deterministic.
// The hook reads svgEl.getBoundingClientRect(), then computes:
//   svgY = e.clientY - svgRect.top - MARGIN.top
//   targetRow = round(svgY / yStep)
// With svgRect.top = 0 and MARGIN.top = 20, e.clientY = MARGIN.top + row * yStep
// snaps to that row exactly.
function stubSvgRect() {
  vi.spyOn(SVGSVGElement.prototype, "getBoundingClientRect").mockReturnValue({
    top: SVG_TOP,
    left: 0,
    right: 800,
    bottom: 600,
    width: 800,
    height: 600,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
}

// jsdom is missing several browser APIs the tree relies on; polyfill them.
beforeEach(() => {
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = function () {};
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = function () {};
  }
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = function () {
      return false;
    };
  }
  if (!(globalThis as { ResizeObserver?: unknown }).ResizeObserver) {
    (globalThis as { ResizeObserver: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  stubSvgRect();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  useTreeStore.setState({
    flatTree: null,
    previewFlatTree: null,
    selectedNodeId: null,
    dragEnabled: true,
    collapsedNodes: new Set(),
  });
  useNJStore.setState({ newick: null, status: "idle", error: null, isStale: false });
});

// Y coordinate (clientY) of the visible row at index `i`. Row 0 is at MARGIN.top.
function rowY(i: number): number {
  return MARGIN.top + i * Y_STEP;
}

function dispatchPointer(
  target: Element | Window,
  type: "pointerdown" | "pointermove" | "pointerup",
  clientX: number,
  clientY: number,
) {
  const ev = new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX,
    clientY,
    pointerId: 1,
    pointerType: "mouse",
  });
  target.dispatchEvent(ev);
}

function findCircleByNodeId(container: HTMLElement, nodeId: string): SVGCircleElement {
  const el = container.querySelector(`circle[data-nodeid="${nodeId}"]`);
  if (!el) throw new Error(`No circle with data-nodeid="${nodeId}"`);
  return el as SVGCircleElement;
}

function leafOrderNames(): string[] {
  const ft = useTreeStore.getState().flatTree!;
  return ft.leafOrder.map((id) => ft.nodes.get(id)!.name);
}

// ---------------------------------------------------------------------------
// Rendering: data-nodeid presence
// ---------------------------------------------------------------------------

describe("useTreeNodeDrag — data-nodeid rendering", () => {
  it("renders data-nodeid on internal-node circles when dragEnabled=true", () => {
    seedTree("((A,B),(C,D));");
    const { container } = render(<Tree />);
    const circles = container.querySelectorAll("circle[data-nodeid]");
    // 4 leaves + 1 non-root internal = 5 circles with data-nodeid (root has none).
    expect(circles.length).toBeGreaterThan(0);
    const internalCircles = Array.from(circles).filter(
      (c) => !["A", "B", "C", "D"].includes(c.getAttribute("data-nodeid") ?? ""),
    );
    expect(internalCircles.length).toBeGreaterThan(0);
  });

  it("does not render data-nodeid on any circle when dragEnabled=false", () => {
    seedTree("((A,B),(C,D));");
    useTreeStore.setState({ dragEnabled: false });
    const { container } = render(<Tree />);
    const circles = container.querySelectorAll("circle[data-nodeid]");
    expect(circles.length).toBe(0);
  });

  it("does not render data-nodeid on the root circle", () => {
    const tree = seedTree("((A,B),(C,D));");
    const { container } = render(<Tree />);
    const rootCircle = container.querySelector(`circle[data-nodeid="${tree.rootId}"]`);
    expect(rootCircle).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Drag flow: end-to-end commits via pointer events
// ---------------------------------------------------------------------------

describe("useTreeNodeDrag — commits via pointerup", () => {
  it("downward drag of an internal-node group commits the new leaf order", () => {
    const tree = seedTree("((A,B),(C,D));");
    // Internal node with children A, B is the first child of root (n0). DFS preorder: n0=root,
    // n1=(A,B) parent, n2=A, n3=B, n4=(C,D) parent, n5=C, n6=D.
    const internalAB = tree.nodes.get(tree.rootId)!.childIds[0];
    const { container } = render(<Tree />);
    const circle = findCircleByNodeId(container, internalAB);

    // Click at row 1 (~midpoint of A,B group), drag down to row 3 (D), release.
    dispatchPointer(circle, "pointerdown", 100, rowY(1));
    dispatchPointer(window, "pointermove", 100, rowY(3));
    dispatchPointer(window, "pointerup", 100, rowY(3));

    expect(leafOrderNames()).toEqual(["C", "D", "A", "B"]);
  });

  it("upward drag of an internal-node group commits the new leaf order — bug 2 mirror", () => {
    const tree = seedTree("((A,B),(C,D));");
    // Internal node with children C, D is the second child of root.
    const internalCD = tree.nodes.get(tree.rootId)!.childIds[1];
    const { container } = render(<Tree />);
    const circle = findCircleByNodeId(container, internalCD);

    // Click at row 2 (mid of C,D), drag up to row 0 (A), release.
    dispatchPointer(circle, "pointerdown", 100, rowY(2));
    dispatchPointer(window, "pointermove", 100, rowY(0));
    dispatchPointer(window, "pointerup", 100, rowY(0));

    expect(leafOrderNames()).toEqual(["C", "D", "A", "B"]);
  });

  it("dragging a leaf circle downward commits a single-leaf reorder", () => {
    const tree = seedTree("(A,B,C,D);");
    const aId = tree.leafOrder[0];
    const { container } = render(<Tree />);
    const circle = findCircleByNodeId(container, aId);

    dispatchPointer(circle, "pointerdown", 100, rowY(0));
    dispatchPointer(window, "pointermove", 100, rowY(2));
    dispatchPointer(window, "pointerup", 100, rowY(2));

    expect(leafOrderNames()).toEqual(["B", "C", "A", "D"]);
  });

  it("syncs the new order to sequenceStore on commit", () => {
    const tree = seedTree("(A,B,C,D);");
    const aId = tree.leafOrder[0];
    const { container } = render(<Tree />);
    const circle = findCircleByNodeId(container, aId);

    dispatchPointer(circle, "pointerdown", 100, rowY(0));
    dispatchPointer(window, "pointermove", 100, rowY(3));
    dispatchPointer(window, "pointerup", 100, rowY(3));

    expect(useSequenceStore.getState().order).toEqual(["B", "C", "D", "A"]);
  });

  it("commits even when pointermove leaves the SVG bounds (window-level listeners)", () => {
    // Real-browser regression check: with the previous addEventListener-on-svg pattern, a
    // pointer that wandered outside the SVG (or any DOM nesting that diverted bubbling) could
    // miss pointermove/pointerup. Window-level listeners must still receive them.
    const tree = seedTree("(A,B,C,D);");
    const aId = tree.leafOrder[0];
    const { container } = render(<Tree />);
    const circle = findCircleByNodeId(container, aId);

    dispatchPointer(circle, "pointerdown", 100, rowY(0));
    // Dispatch on document.body — outside the SVG element's subtree.
    dispatchPointer(document.body, "pointermove", 100, rowY(2));
    dispatchPointer(document.body, "pointerup", 100, rowY(2));

    expect(leafOrderNames()).toEqual(["B", "C", "A", "D"]);
  });
});

// ---------------------------------------------------------------------------
// Topology-preservation regression: rotation only, no polytomies
// ---------------------------------------------------------------------------

describe("useTreeNodeDrag — preserves topology (rotation-only commit)", () => {
  // Snapshot the parent→childIds set for every internal node. Drag must preserve this exact
  // set (as an unordered group) — child ORDER may change (that's rotation), but no new
  // internal nodes are created, no nodes are removed, and no internal node gains or loses
  // children. This is the strongest "no topology change" invariant.
  function snapshotChildSets(ft: ReturnType<typeof flattenTree>): Map<string, Set<string>> {
    const m = new Map<string, Set<string>>();
    for (const [id, node] of ft.nodes) m.set(id, new Set(node.childIds));
    return m;
  }

  function setsEqual(a: Set<string>, b: Set<string>): boolean {
    if (a.size !== b.size) return false;
    for (const x of a) if (!b.has(x)) return false;
    return true;
  }

  it("does not introduce polytomies or change parent→child sets when dragging an internal node", () => {
    // Binary tree. After any rotation-only drag, the topology (parent→childIds as a set)
    // must be unchanged. ORDER of children is allowed to change.
    const tree = seedTree("((A,B),(C,D));");
    const before = snapshotChildSets(tree);
    const internalAB = tree.nodes.get(tree.rootId)!.childIds[0];
    const { container } = render(<Tree />);
    const circle = findCircleByNodeId(container, internalAB);

    dispatchPointer(circle, "pointerdown", 100, rowY(1));
    dispatchPointer(window, "pointermove", 100, rowY(3));
    dispatchPointer(window, "pointerup", 100, rowY(3));

    const after = useTreeStore.getState().flatTree!;
    expect(after.nodes.size).toBe(tree.nodes.size); // no node added or removed
    for (const [id, childSet] of before) {
      expect(after.nodes.has(id)).toBe(true);
      expect(setsEqual(after.nodes.get(id)!.childIds.length === 0 ? new Set() : new Set(after.nodes.get(id)!.childIds), childSet))
        .toBe(true);
    }

    // No internal node has more children than it started with (extra-strict polytomy guard).
    for (const [id, childSet] of before) {
      expect(after.nodes.get(id)!.childIds.length).toBe(childSet.size);
    }
  });

  it("preserves topology across a deeper tree with multiple drags", () => {
    const tree = seedTree("((A,B),(C,(D,E)));");
    const before = snapshotChildSets(tree);
    const aId = tree.leafOrder[0];
    const { container } = render(<Tree />);
    const circle = findCircleByNodeId(container, aId);

    dispatchPointer(circle, "pointerdown", 100, rowY(0));
    dispatchPointer(window, "pointermove", 100, rowY(4));
    dispatchPointer(window, "pointerup", 100, rowY(4));

    const after = useTreeStore.getState().flatTree!;
    expect(after.nodes.size).toBe(tree.nodes.size);
    for (const [id, childSet] of before) {
      expect(after.nodes.has(id)).toBe(true);
      expect(after.nodes.get(id)!.childIds.length).toBe(childSet.size); // no polytomy growth
    }
  });
});

// ---------------------------------------------------------------------------
// Late-mount regression: flatTree set AFTER initial render
// ---------------------------------------------------------------------------

describe("useTreeNodeDrag — late mount of the SVG element", () => {
  // Regression: Tree returns early until flatTree loads, so the SVG element does not exist on
  // the hook's first effect run. With a useRef-based svgRef, the effect saw svgRef.current = null
  // and skipped attaching window listeners, never re-running afterwards. Switching svgRef to
  // a callback ref + tracking the element in state fixed this. This test reproduces the
  // late-mount path: render with no flatTree, then set it, then drag.
  it("attaches drag listeners and supports drag when flatTree arrives after the initial render", () => {
    // Initial state: no flatTree. Tree renders the "No tree computed yet." placeholder.
    useTreeStore.setState({
      flatTree: null,
      previewFlatTree: null,
      layoutMode: "rectangular",
      yStep: Y_STEP,
      collapsedNodes: new Set(),
      nodeStyles: new Map(),
      branchStyles: new Map(),
      selectedNodeId: null,
      dragEnabled: true,
      nodeRadius: 3,
      branchWidth: 1,
      labelFontSize: 12,
    });
    useNJStore.setState({ newick: null, status: "done", error: null, isStale: false });

    const { container } = render(<Tree />);
    // Pre-mount: no SVG-circle drag targets yet.
    expect(container.querySelector("circle[data-nodeid]")).toBeNull();

    // Now load a tree (mirrors the newick effect in <Tree /> firing later).
    const ft = flattenTree(parseNewick("(A,B,C,D);"));
    act(() => {
      useTreeStore.setState({ flatTree: ft });
      useSequenceStore.setState({
        order: ft.leafOrder.map((id) => ft.nodes.get(id)!.name),
        selectedIdentifier: null,
        unmatchedLeafNames: [],
      });
    });

    // Post-mount: SVG circles exist and drag should work end-to-end.
    const aId = ft.leafOrder[0];
    const circle = findCircleByNodeId(container, aId);
    dispatchPointer(circle, "pointerdown", 100, rowY(0));
    dispatchPointer(window, "pointermove", 100, rowY(2));
    dispatchPointer(window, "pointerup", 100, rowY(2));

    expect(leafOrderNames()).toEqual(["B", "C", "A", "D"]);
  });
});

// ---------------------------------------------------------------------------
// Reroot-via-drag
// ---------------------------------------------------------------------------

describe("useTreeNodeDrag — reroot via drag past the outgroup", () => {
  it("dragging an internal node above the topmost row by > 1 yStep triggers a reroot", () => {
    // Tree with a non-binary root so rerooting on a direct child is a real topology change.
    // Drag clade (C,D) well above row 0 → reroot on (C,D).
    const tree = seedTree("((A,B),(C,D),E);");
    const internalCD = tree.nodes.get(tree.rootId)!.childIds[1];
    const { container } = render(<Tree />);
    const circle = findCircleByNodeId(container, internalCD);

    // Click at row 2 (mid of C,D), drag up well past row 0 (clientY = -50 → far above).
    dispatchPointer(circle, "pointerdown", 100, rowY(2));
    dispatchPointer(window, "pointermove", 100, -50);
    dispatchPointer(window, "pointerup", 100, -50);

    // Topology changed: leaf order now starts with C, D (the rerooted outgroup).
    expect(leafOrderNames().slice(0, 2)).toEqual(["C", "D"]);
    expect(useTreeStore.getState().flatTree!.isRerooted).toBe(true);
  });

  it("dragging an internal node below the bottommost row by > 1 yStep triggers a reroot", () => {
    // After below-outgroup reroot, the dragged clade should land at the BOTTOM of the order
    // (we rotate the new root's children so the dropped position matches).
    const tree = seedTree("((A,B),(C,D),E);");
    const internalAB = tree.nodes.get(tree.rootId)!.childIds[0];
    const { container } = render(<Tree />);
    const circle = findCircleByNodeId(container, internalAB);

    // Click at row 0 (mid of A,B), drag down well past row 4 to clientY = 200.
    dispatchPointer(circle, "pointerdown", 100, rowY(0));
    dispatchPointer(window, "pointermove", 100, 200);
    dispatchPointer(window, "pointerup", 100, 200);

    // (A,B) should now be at the bottom of the leaf order.
    expect(leafOrderNames().slice(-2)).toEqual(["A", "B"]);
    expect(useTreeStore.getState().flatTree!.isRerooted).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Drag thresholds and edge cases
// ---------------------------------------------------------------------------

describe("useTreeNodeDrag — thresholds and no-ops", () => {
  it("does not commit when movement is below DRAG_THRESHOLD", () => {
    const tree = seedTree("(A,B,C,D);");
    const aId = tree.leafOrder[0];
    const before = leafOrderNames();
    const { container } = render(<Tree />);
    const circle = findCircleByNodeId(container, aId);

    // 2 px movement is below the 4 px threshold → no drag, no commit.
    dispatchPointer(circle, "pointerdown", 100, rowY(0));
    dispatchPointer(window, "pointermove", 100, rowY(0) + 2);
    dispatchPointer(window, "pointerup", 100, rowY(0) + 2);

    expect(leafOrderNames()).toEqual(before);
  });

  it("does not commit when pointermove keeps the target inside the dragged group", () => {
    // Click an internal node and stay inside the group's vertical extent — the silent-freeze
    // bug-1 regression. With planLeafReorder, in-group targets are documented no-ops, so the
    // commit on pointerup must NOT change the order.
    const tree = seedTree("(A,(B,C,D),E);");
    const internal = tree.nodes.get(tree.rootId)!.childIds[1]; // (B,C,D)
    const before = leafOrderNames();
    const { container } = render(<Tree />);
    const circle = findCircleByNodeId(container, internal);

    // Click at the group's center (row 2 = C), drag down a tiny amount but stay within
    // the group (row 3 = D, still inside [1..3]).
    dispatchPointer(circle, "pointerdown", 100, rowY(2));
    dispatchPointer(window, "pointermove", 100, rowY(3));
    dispatchPointer(window, "pointerup", 100, rowY(3));

    expect(leafOrderNames()).toEqual(before);
  });

  it("dragging the top child of a binary root upward past the SVG does not change branch lengths", () => {
    // User scenario: midpoint-rooted tree (binary root). Dragging either of the root's
    // two children "outward" (above the top or below the bottom) is a topological no-op,
    // since rerooting on a direct child of a binary root gives back the same tree.
    // Prior to the rerootFlat guard, the dragged node's parent-branch length was halved.
    const tree = seedTree("((A:1,B:1):2,(C:1,D:1):3);");
    const topInternal = tree.nodes.get(tree.rootId)!.childIds[0];
    const lengthBefore = tree.nodes.get(topInternal)!.length;
    const { container } = render(<Tree />);
    const circle = findCircleByNodeId(container, topInternal);

    // Drag from middle of top clade well above the SVG top (reroot zone) and release.
    dispatchPointer(circle, "pointerdown", 100, rowY(0));
    dispatchPointer(window, "pointermove", 100, -50);
    dispatchPointer(window, "pointerup", 100, -50);

    const after = useTreeStore.getState().flatTree!;
    expect(after.nodes.get(topInternal)!.length).toBe(lengthBefore);
  });

  it("does not reroot or change branch lengths when pointer briefly enters reroot zone then returns", () => {
    // Regression: prior to the fix, transient entry into the reroot zone set lastMode to
    // "reroot-above"/"reroot-below". If the pointer then returned to a position where
    // planLeafReorder yielded no plan (e.g. inside the dragged group), pointerup would still
    // commit the reroot, halving the dragged node's parent branch length.
    const tree = seedTree("((A:1,B:1):2,(C:1,D:1):2);");
    const internalCD = tree.nodes.get(tree.rootId)!.childIds[1];
    const lengthBefore = tree.nodes.get(internalCD)!.length;
    const orderBefore = leafOrderNames();
    const { container } = render(<Tree />);
    const circle = findCircleByNodeId(container, internalCD);

    // Click mid (C,D) at row 2.5 — between rows 2 and 3. Move pointer far above (reroot zone),
    // then back to a position whose target row falls inside the dragged group (row 2 or 3) so
    // planLeafReorder returns null. Release.
    dispatchPointer(circle, "pointerdown", 100, rowY(2));
    dispatchPointer(window, "pointermove", 100, -50); // far above → reroot-above intent
    dispatchPointer(window, "pointermove", 100, rowY(3)); // back inside dragged group
    dispatchPointer(window, "pointerup", 100, rowY(3));

    const after = useTreeStore.getState().flatTree!;
    expect(after.isRerooted).toBe(false);
    expect(after.nodes.get(internalCD)!.length).toBe(lengthBefore);
    expect(leafOrderNames()).toEqual(orderBefore);
  });
});
