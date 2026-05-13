import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import TreeLabels from "./TreeLabels";
import { useTreeStore } from "../treeStore";
import { useSequenceStore } from "../../sequenceStore";
import { buildLayout, flattenTree, parseNewick } from "../layout";
import { MARGIN } from "../constants";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const Y_STEP = 22;
const ROW_HEIGHT = Y_STEP;
// SequenceLabels coordinate system (with our stubbed inner-div top = 0):
//   paddingTop = MARGIN.top - yStep/2 = 20 - 11 = 9
//   relativeY = clientY - paddingTop
//   row index = Math.floor(relativeY / rowHeight)  ← rows are half-open [i*h, (i+1)*h)
// Row i's CENTER is at clientY = paddingTop + i*rowHeight + rowHeight/2 = MARGIN.top + i*rowHeight.
// floor((row center - paddingTop) / rowHeight) = floor((i*22 + 11)/22) = i ✓
function rowY(i: number): number {
  return MARGIN.top + i * ROW_HEIGHT;
}

function seedTree(newick: string) {
  const ft = flattenTree(parseNewick(newick));
  useTreeStore.setState({
    flatTree: ft,
    previewFlatTree: null,
    layoutMode: "rectangular",
    yStep: Y_STEP,
    collapsedNodes: new Set(),
    nodeStyles: new Map(),
    selectedNodeId: null,
    searchQuery: "",
    dragEnabled: true,
  });
  useSequenceStore.setState({
    order: ft.leafOrder.map((id) => ft.nodes.get(id)!.name),
    selectedIdentifier: null,
    unmatchedLeafNames: [],
  });
  return ft;
}

function stubBoundingRect() {
  // SequenceLabels reads the inner div's getBoundingClientRect (.top). Stub all elements
  // (HTMLElement and SVG) at origin (0, 0) so clientY maps directly to row math.
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    top: 0,
    left: 0,
    right: 220,
    bottom: 600,
    width: 220,
    height: 600,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
}

beforeEach(() => {
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = function () {};
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = function () {};
  }
  stubBoundingRect();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  useTreeStore.setState({
    flatTree: null,
    previewFlatTree: null,
    selectedNodeId: null,
    collapsedNodes: new Set(),
  });
});

function dispatchPointer(
  target: Element,
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

function renderLabels(newick: string) {
  const tree = seedTree(newick);
  const { root } = buildLayout(tree, "rectangular", Y_STEP, 100, new Set());
  const result = render(
    <TreeLabels layoutRoot={root} yStep={Y_STEP} labelWidth={220} svgHeight={600} />,
  );
  return { tree, ...result };
}

function leafOrderNames(): string[] {
  const ft = useTreeStore.getState().flatTree!;
  return ft.leafOrder.map((id) => ft.nodes.get(id)!.name);
}

// Find the label-row div for a given leaf name. Each row has the leaf text and a pointerdown
// handler. We pick the deepest div whose direct text content (or one of its children) is the name.
function findRowByName(container: HTMLElement, name: string): HTMLElement {
  // Each label row contains a <span> with the displayName. Walk up to the row div.
  const spans = container.querySelectorAll("span");
  for (const span of spans) {
    if (span.textContent?.trim() === name) {
      let el: HTMLElement | null = span as HTMLElement;
      // The row div has style.height set; walk up at most 3 levels to find it.
      for (let i = 0; i < 3 && el; i++) {
        if (el.style.height === `${Y_STEP}px`) return el;
        el = el.parentElement;
      }
    }
  }
  throw new Error(`Could not find label row for ${name}`);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("TreeLabels — label-row drag", () => {
  it("dragging a leaf row down past another row commits the new order", () => {
    const { container } = renderLabels("(A,B,C,D);");
    const row = findRowByName(container, "A");

    dispatchPointer(row, "pointerdown", 10, rowY(0));
    dispatchPointer(row, "pointermove", 10, rowY(2));
    dispatchPointer(row, "pointerup", 10, rowY(2));

    expect(leafOrderNames()).toEqual(["B", "C", "A", "D"]);
  });

  it("dragging a leaf row up past another row commits the new order", () => {
    const { container } = renderLabels("(A,B,C,D);");
    const row = findRowByName(container, "D");

    dispatchPointer(row, "pointerdown", 10, rowY(3));
    dispatchPointer(row, "pointermove", 10, rowY(1));
    dispatchPointer(row, "pointerup", 10, rowY(1));

    expect(leafOrderNames()).toEqual(["A", "D", "B", "C"]);
  });

  it("syncs the new order to sequenceStore on commit", () => {
    const { container } = renderLabels("(A,B,C,D);");
    const row = findRowByName(container, "A");

    dispatchPointer(row, "pointerdown", 10, rowY(0));
    dispatchPointer(row, "pointermove", 10, rowY(3));
    dispatchPointer(row, "pointerup", 10, rowY(3));

    expect(useSequenceStore.getState().order).toEqual(["B", "C", "D", "A"]);
  });

  it("dragging less than DRAG_THRESHOLD pixels does not commit", () => {
    const { container } = renderLabels("(A,B,C,D);");
    const row = findRowByName(container, "A");
    const before = leafOrderNames();

    dispatchPointer(row, "pointerdown", 10, rowY(0));
    dispatchPointer(row, "pointermove", 11, rowY(0) + 2);
    dispatchPointer(row, "pointerup", 11, rowY(0) + 2);

    expect(leafOrderNames()).toEqual(before);
  });
});
