import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { JSX } from "react";
import { useContainerWidth } from "../hooks/useContainerWidth";
import { useNJStore } from "../NJ/njStore";
import { useEditStore } from "../editStore";
import { buildLayout, flattenTree, parseNewick } from "./layout";
import type { LayoutNode } from "./types";
import { useTreeStore } from "./treeStore";
import { useSequenceStore } from "../sequenceStore";
import { DIVIDER_WIDTH, MARGIN, RADIAL_LABEL_GAP } from "./constants";
import { useLabelDividerResize } from "./hooks/useLabelDividerResize";
import NodePanel from "./components/NodePanel";
import type { PanelState } from "./types";
import BranchPanel from "./components/BranchPanel";
import Branches from "./components/Branches";
import TreeLabels from "./components/TreeLabels";
import TreeToolbar from "./components/TreeToolbar";
import ScaleBar from "./components/ScaleBar";
import NJStatusBar from "./components/NJStatusBar";

export default function Tree(): JSX.Element {
  const { newick, status, error } = useNJStore();
  const {
    layoutMode,
    yStep,
    flatTree,
    collapsedNodes,
    selectedNodeId,
    setSelectedNodeId,
    setFlatTree,
  } = useTreeStore();

  const [containerRef, containerWidth] = useContainerWidth();
  const svgRef = useRef<SVGSVGElement>(null);
  const { labelWidth, onMouseDown: onDividerMouseDown, onTouchStart: onDividerTouchStart } =
    useLabelDividerResize();

  const [panel, setPanel] = useState<PanelState | null>(null);
  const [branchPanel, setBranchPanel] = useState<PanelState | null>(null);

  useEffect(() => {
    if (!selectedNodeId) setPanel(null);
  }, [selectedNodeId]);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.shiftKey && e.key === "z") { e.preventDefault(); useEditStore.getState().redo(); return; }
      if (mod && e.key === "z") { e.preventDefault(); useEditStore.getState().undo(); }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (!newick) return;
    try {
      const ft = flattenTree(parseNewick(newick));
      setFlatTree(ft);
      const leafNames = ft.leafOrder.map((id) => ft.nodes.get(id)!.name);
      useSequenceStore.getState().syncFromTreeLeafOrder(leafNames);
    } catch (e) {
      console.error("Failed to parse newick:", e, "\nNewick string:", newick);
    }
  }, [newick, setFlatTree]);

  const treeWidth =
    containerWidth > 0
      ? Math.max(200, containerWidth - MARGIN.left - MARGIN.right - DIVIDER_WIDTH - labelWidth)
      : 560;

  const maxRadius = Math.min(treeWidth, 300) / 2;

  const layoutResult = useMemo(() => {
    if (!flatTree) return null;
    return buildLayout(flatTree, layoutMode, yStep, maxRadius, collapsedNodes);
  }, [flatTree, layoutMode, yStep, collapsedNodes, maxRadius]);

  const handleNodeClick = useCallback(
    (node: LayoutNode, e: React.MouseEvent) => {
      e.preventDefault();
      setSelectedNodeId(node.id);
      setPanel({
        id: node.id,
        isLeaf: node.children.length === 0,
        leafName: node.children.length === 0 ? node.node.name : undefined,
        x: e.clientX,
        y: e.clientY,
      });
    },
    [setSelectedNodeId],
  );

  const handleClosePanel = useCallback(() => {
    setSelectedNodeId(null);
    setPanel(null);
  }, [setSelectedNodeId]);

  const handleBranchClick = useCallback((node: LayoutNode, e: React.MouseEvent) => {
    e.preventDefault();
    setBranchPanel({
      id: node.id,
      isLeaf: node.children.length === 0,
      leafName: node.children.length === 0 ? node.node.name : undefined,
      x: e.clientX,
      y: e.clientY,
    });
  }, []);

  const handleCloseBranchPanel = useCallback(() => {
    setBranchPanel(null);
  }, []);

  const isStale = useNJStore((s) => s.isStale);

  if (status === "running") {
    return (
      <div ref={containerRef} className="p-4">
        <p className="opacity-60">Computing Neighbor-Joining tree…</p>
      </div>
    );
  }
  if (status === "error") {
    return (
      <div ref={containerRef} className="p-4">
        <p className="text-error">Tree error: {error}</p>
      </div>
    );
  }
  if (!layoutResult) {
    return (
      <div ref={containerRef} className="p-4">
        <p className="opacity-60">No tree computed yet.</p>
      </div>
    );
  }

  const { root: layoutRoot, nLeaves, maxDepth } = layoutResult;
  const isRadial = layoutMode === "radial";

  const svgWidth = MARGIN.left + treeWidth + MARGIN.right;
  const svgHeight = isRadial
    ? (maxRadius + RADIAL_LABEL_GAP + 60) * 2 + MARGIN.top + MARGIN.bottom
    : nLeaves * yStep + MARGIN.top + MARGIN.bottom;

  const xScale = maxDepth > 0 ? treeWidth / maxDepth : treeWidth;
  const radCx = maxRadius + RADIAL_LABEL_GAP + 40;
  const radCy = maxRadius + RADIAL_LABEL_GAP + 40;

  const clearSelection = () => {
    setSelectedNodeId(null);
    setPanel(null);
    setBranchPanel(null);
  };

  return (
    <div ref={containerRef} className="flex flex-col gap-0 h-full">
      {isStale && (
        <div className="alert alert-warning py-1 px-3 text-xs rounded-none flex-shrink-0">
          Alignment has been edited — re-run analysis to update the tree.
        </div>
      )}
      <TreeToolbar />
      <div style={{ overflowY: "auto", overflowX: "hidden", flex: 1 }}>
        <div className="flex">
          <svg
            ref={svgRef}
            width={svgWidth}
            height={svgHeight}
            style={{
              fontFamily: '"Azeret Mono", ui-monospace, monospace',
              display: "block",
              flexShrink: 0,
            }}
            onClick={clearSelection}
          >
            <g transform={`translate(${MARGIN.left}, ${MARGIN.top})`}>
              {isRadial ? (
                <Branches
                  mode="radial"
                  node={layoutRoot}
                  isRoot
                  parentR={0}
                  cx={radCx}
                  cy={radCy}
                  maxRadius={maxRadius}
                  onNodeClick={handleNodeClick}
                  onBranchClick={handleBranchClick}
                />
              ) : (
                <>
                  <Branches
                    mode="rect"
                    node={layoutRoot}
                    isRoot
                    parentX={layoutRoot.x}
                    xScale={xScale}
                    treeWidth={treeWidth}
                    onNodeClick={handleNodeClick}
                    onBranchClick={handleBranchClick}
                  />
                  {maxDepth > 0 && (
                    <ScaleBar
                      scaleVal={Math.max(0, maxDepth * 0.1)}
                      scalePx={Math.max(0, maxDepth * 0.1) * xScale}
                      nLeaves={nLeaves}
                    />
                  )}
                </>
              )}
            </g>
          </svg>

          {!isRadial && (
            <>
              <div
                className="group"
                onMouseDown={onDividerMouseDown}
                onTouchStart={onDividerTouchStart}
                style={{
                  width: DIVIDER_WIDTH,
                  flexShrink: 0,
                  cursor: "col-resize",
                  display: "flex",
                  alignItems: "stretch",
                  justifyContent: "center",
                }}
              >
                <div className="w-px bg-base-300 group-hover:bg-primary transition-colors" />
              </div>
              <TreeLabels
                layoutRoot={layoutRoot}
                yStep={yStep}
                labelWidth={labelWidth}
                svgHeight={svgHeight}
              />
            </>
          )}
        </div>
      </div>

      {panel && (
        <NodePanel panel={panel} layoutRoot={layoutRoot} onClose={handleClosePanel} />
      )}
      {branchPanel && (
        <BranchPanel panel={branchPanel} layoutRoot={layoutRoot} onClose={handleCloseBranchPanel} />
      )}

      <NJStatusBar />
    </div>
  );
}
