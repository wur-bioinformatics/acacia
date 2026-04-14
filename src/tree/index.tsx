import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { JSX } from "react";
import { useContainerWidth } from "../hooks/useContainerWidth";
import { useNJStore } from "../NJ/njStore";
import { buildLayout, computeLeafCounts, parseNewick } from "./layout";
import type { LayoutNode } from "./types";
import { useTreeStore } from "./treeStore";
import { LABEL_WIDTH, MARGIN, Y_STEP, RADIAL_LABEL_GAP } from "./constants";
import useTreePanZoom from "./hooks/useTreePanZoom";
import NodePanel from "./components/NodePanel";
import type { PanelState } from "./components/NodePanel";
import Branches from "./components/Branches";
import TreeToolbar from "./components/TreeToolbar";
import ScaleBar from "./components/ScaleBar";
import NJStatusBar from "./components/NJStatusBar";

export default function Tree(): JSX.Element {
  const { newick, status, error } = useNJStore();
  const {
    layoutMode,
    panX,
    panY,
    zoom,
    root,
    collapsedNodes,
    selectedNodeId,
    setSelectedNodeId,
    setOriginalRoot,
  } = useTreeStore();

  const [containerRef, containerWidth] = useContainerWidth();
  const svgRef = useRef<SVGSVGElement>(null);
  const didDragRef = useTreePanZoom(svgRef);

  const [panel, setPanel] = useState<PanelState | null>(null);

  // Close panel when selection is cleared (e.g. by rerootOnBranch in the store)
  useEffect(() => {
    if (!selectedNodeId) setPanel(null);
  }, [selectedNodeId]);

  useEffect(() => {
    if (!newick) return;
    try {
      setOriginalRoot(parseNewick(newick));
    } catch (e) {
      console.error("Failed to parse newick:", e, "\nNewick string:", newick);
    }
  }, [newick, setOriginalRoot]);

  const leafCounts = useMemo(() => {
    if (!root) return new Map();
    return computeLeafCounts(root);
  }, [root]);

  const treeWidth =
    containerWidth > 0
      ? Math.max(200, containerWidth - MARGIN.left - LABEL_WIDTH - MARGIN.right)
      : 560;

  const maxRadius = Math.min(treeWidth, 300) / 2;

  const layoutResult = useMemo(() => {
    if (!root) return null;
    return buildLayout(root, layoutMode, Y_STEP, maxRadius, collapsedNodes, leafCounts);
  }, [root, layoutMode, collapsedNodes, leafCounts, maxRadius]);

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

  const svgWidth =
    containerWidth > 0
      ? containerWidth
      : treeWidth + MARGIN.left + LABEL_WIDTH + MARGIN.right;
  const svgHeight = isRadial
    ? (maxRadius + RADIAL_LABEL_GAP + 60) * 2 + MARGIN.top + MARGIN.bottom
    : nLeaves * Y_STEP + MARGIN.top + MARGIN.bottom;

  const xScale = maxDepth > 0 ? treeWidth / maxDepth : treeWidth;
  const radCx = maxRadius + RADIAL_LABEL_GAP + 40;
  const radCy = maxRadius + RADIAL_LABEL_GAP + 40;

  return (
    <div ref={containerRef} className="flex flex-col gap-0 h-full">
      <TreeToolbar />
      <div style={{ overflow: "hidden", flex: 1 }}>
        <svg
          ref={svgRef}
          width={svgWidth}
          height={svgHeight}
          style={{
            fontFamily: "ui-monospace, monospace",
            touchAction: "none",
            display: "block",
          }}
          onClick={() => {
            if (!didDragRef.current) {
              setSelectedNodeId(null);
              setPanel(null);
            }
          }}
        >
          <g transform={`translate(${panX}, ${panY}) scale(${zoom})`}>
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
                  didDragRef={didDragRef}
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
                    didDragRef={didDragRef}
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
          </g>
        </svg>
      </div>

      {panel && (
        <NodePanel
          panel={panel}
          layoutRoot={layoutRoot}
          onClose={handleClosePanel}
        />
      )}

      <NJStatusBar />
    </div>
  );
}
