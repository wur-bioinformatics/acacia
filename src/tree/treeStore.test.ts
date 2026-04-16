import { describe, it, expect, beforeEach } from "vitest";
import { useTreeStore } from "./treeStore";
import { parseNewick, flattenTree } from "./layout";

// A simple three-leaf tree used across tests: ((A,B),C)
const makeTree = () => flattenTree(parseNewick("((A,B),C);"));

beforeEach(() => {
  useTreeStore.setState({
    layoutMode: "rectangular",
    yStep: 22,
    flatTree: null,
    collapsedNodes: new Set(),
    nodeStyles: new Map(),
    branchStyles: new Map(),
    selectedNodeId: null,
    showBootstrap: true,
  });
});

describe("treeStore simple setters", () => {
  it("setLayoutMode updates layoutMode", () => {
    useTreeStore.getState().setLayoutMode("cladogram");
    expect(useTreeStore.getState().layoutMode).toBe("cladogram");
  });

  it("setYStep updates yStep", () => {
    useTreeStore.getState().setYStep(30);
    expect(useTreeStore.getState().yStep).toBe(30);
  });

  it("setShowBootstrap updates showBootstrap", () => {
    useTreeStore.getState().setShowBootstrap(false);
    expect(useTreeStore.getState().showBootstrap).toBe(false);
  });

  it("setSelectedNodeId sets a node ID", () => {
    useTreeStore.getState().setSelectedNodeId("n1");
    expect(useTreeStore.getState().selectedNodeId).toBe("n1");
  });

  it("setSelectedNodeId can be cleared to null", () => {
    useTreeStore.getState().setSelectedNodeId("n1");
    useTreeStore.getState().setSelectedNodeId(null);
    expect(useTreeStore.getState().selectedNodeId).toBeNull();
  });
});

describe("treeStore setFlatTree", () => {
  it("stores the flat tree", () => {
    const ft = makeTree();
    useTreeStore.getState().setFlatTree(ft);
    expect(useTreeStore.getState().flatTree).toBe(ft);
  });

  it("clears styles, collapsed nodes and selection", () => {
    useTreeStore.setState({
      collapsedNodes: new Set(["n1"]),
      nodeStyles: new Map([["leaf:A", { color: "red", labelBold: true }]]),
      branchStyles: new Map([["branch:n1", { color: "blue" }]]),
      selectedNodeId: "n1",
    });
    useTreeStore.getState().setFlatTree(makeTree());
    const s = useTreeStore.getState();
    expect(s.collapsedNodes.size).toBe(0);
    expect(s.nodeStyles.size).toBe(0);
    expect(s.branchStyles.size).toBe(0);
    expect(s.selectedNodeId).toBeNull();
  });
});

describe("treeStore resetRoot", () => {
  it("restores the original flat tree after a reroot", () => {
    const ft = makeTree();
    useTreeStore.getState().setFlatTree(ft);
    // Find a leaf ID to reroot on
    const leafId = ft.leafOrder[0];
    useTreeStore.getState().rerootOnBranch(leafId);
    // After reroot the tree has changed
    expect(useTreeStore.getState().flatTree?.isRerooted).toBe(true);
    // Reset should restore the original
    useTreeStore.getState().resetRoot();
    expect(useTreeStore.getState().flatTree).toBe(ft);
  });

  it("clears styles and selection on reset", () => {
    useTreeStore.getState().setFlatTree(makeTree());
    useTreeStore.setState({
      nodeStyles: new Map([["leaf:A", { color: "red", labelBold: false }]]),
      selectedNodeId: "n0",
    });
    useTreeStore.getState().resetRoot();
    expect(useTreeStore.getState().nodeStyles.size).toBe(0);
    expect(useTreeStore.getState().selectedNodeId).toBeNull();
  });
});

describe("treeStore rerootOnBranch", () => {
  it("sets isRerooted to true", () => {
    const ft = makeTree();
    useTreeStore.getState().setFlatTree(ft);
    const leafId = ft.leafOrder[0];
    useTreeStore.getState().rerootOnBranch(leafId);
    expect(useTreeStore.getState().flatTree?.isRerooted).toBe(true);
  });

  it("clears selectedNodeId after reroot", () => {
    const ft = makeTree();
    useTreeStore.getState().setFlatTree(ft);
    useTreeStore.setState({ selectedNodeId: "n1" });
    useTreeStore.getState().rerootOnBranch(ft.leafOrder[0]);
    expect(useTreeStore.getState().selectedNodeId).toBeNull();
  });

  it("preserves node count after reroot", () => {
    const ft = makeTree();
    useTreeStore.getState().setFlatTree(ft);
    const nodesBefore = ft.nodes.size;
    useTreeStore.getState().rerootOnBranch(ft.leafOrder[0]);
    expect(useTreeStore.getState().flatTree?.nodes.size).toBe(nodesBefore);
  });

  it("does nothing when flatTree is null", () => {
    useTreeStore.getState().rerootOnBranch("n1");
    expect(useTreeStore.getState().flatTree).toBeNull();
  });
});

describe("treeStore rotateNode", () => {
  it("changes child order for a node with children", () => {
    const ft = makeTree();
    useTreeStore.getState().setFlatTree(ft);
    const rootId = ft.rootId;
    const childsBefore = [...ft.nodes.get(rootId)!.childIds];
    useTreeStore.getState().rotateNode(rootId);
    const childsAfter = [
      ...useTreeStore.getState().flatTree!.nodes.get(rootId)!.childIds,
    ];
    expect(childsAfter).toEqual([...childsBefore].reverse());
  });

  it("does nothing when flatTree is null", () => {
    useTreeStore.getState().rotateNode("n0");
    expect(useTreeStore.getState().flatTree).toBeNull();
  });
});

describe("treeStore toggleCollapse", () => {
  it("adds a node to collapsedNodes", () => {
    useTreeStore.getState().toggleCollapse("n1");
    expect(useTreeStore.getState().collapsedNodes.has("n1")).toBe(true);
  });

  it("removes a node that was already collapsed", () => {
    useTreeStore.getState().toggleCollapse("n1");
    useTreeStore.getState().toggleCollapse("n1");
    expect(useTreeStore.getState().collapsedNodes.has("n1")).toBe(false);
  });

  it("does not affect other collapsed nodes", () => {
    useTreeStore.getState().toggleCollapse("n1");
    useTreeStore.getState().toggleCollapse("n2");
    useTreeStore.getState().toggleCollapse("n1"); // un-collapse n1
    expect(useTreeStore.getState().collapsedNodes.has("n2")).toBe(true);
    expect(useTreeStore.getState().collapsedNodes.has("n1")).toBe(false);
  });
});

describe("treeStore node and branch styles", () => {
  it("setNodeStyle merges partial style onto defaults", () => {
    useTreeStore.getState().setNodeStyle("leaf:A", { color: "red" });
    const style = useTreeStore.getState().nodeStyles.get("leaf:A");
    expect(style?.color).toBe("red");
    expect(style?.labelBold).toBe(false); // default preserved
  });

  it("setNodeStyle merges multiple updates", () => {
    useTreeStore.getState().setNodeStyle("leaf:A", { color: "red" });
    useTreeStore.getState().setNodeStyle("leaf:A", { labelBold: true });
    const style = useTreeStore.getState().nodeStyles.get("leaf:A");
    expect(style?.color).toBe("red");
    expect(style?.labelBold).toBe(true);
  });

  it("clearNodeStyle removes the entry", () => {
    useTreeStore.getState().setNodeStyle("leaf:A", { color: "red" });
    useTreeStore.getState().clearNodeStyle("leaf:A");
    expect(useTreeStore.getState().nodeStyles.has("leaf:A")).toBe(false);
  });

  it("setBranchStyle sets branch color", () => {
    useTreeStore.getState().setBranchStyle("branch:n1", "green");
    expect(useTreeStore.getState().branchStyles.get("branch:n1")).toEqual({
      color: "green",
    });
  });

  it("clearBranchStyle removes the entry", () => {
    useTreeStore.getState().setBranchStyle("branch:n1", "green");
    useTreeStore.getState().clearBranchStyle("branch:n1");
    expect(useTreeStore.getState().branchStyles.has("branch:n1")).toBe(false);
  });
});

describe("treeStore resetStyles", () => {
  it("clears all styles and selection", () => {
    useTreeStore.setState({
      collapsedNodes: new Set(["n1"]),
      nodeStyles: new Map([["leaf:A", { color: "red", labelBold: true }]]),
      branchStyles: new Map([["branch:n1", { color: "blue" }]]),
      selectedNodeId: "n1",
    });
    useTreeStore.getState().resetStyles();
    const s = useTreeStore.getState();
    expect(s.collapsedNodes.size).toBe(0);
    expect(s.nodeStyles.size).toBe(0);
    expect(s.branchStyles.size).toBe(0);
    expect(s.selectedNodeId).toBeNull();
  });

  it("does not affect flatTree", () => {
    const ft = makeTree();
    useTreeStore.getState().setFlatTree(ft);
    useTreeStore.getState().resetStyles();
    expect(useTreeStore.getState().flatTree).toBe(ft);
  });
});
