import { useCallback, useEffect, useMemo, useState } from "react";
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
import { useTreeNodeDrag } from "./hooks/useTreeNodeDrag";
import NodePanel from "./components/NodePanel";
import type { PanelState } from "./types";
import BranchPanel from "./components/BranchPanel";
import Branches from "./components/Branches";
import TreeLabels from "./components/TreeLabels";
import TreeToolbar from "./components/TreeToolbar";
import ScaleBar from "./components/ScaleBar";
import NJStatusBar from "./components/NJStatusBar";
import { downloadFile, flatTreeToNewick, serializeTreePNG, serializeTreeSVG } from "./utils/export";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function Tree(): JSX.Element {
  const { newick, status, error } = useNJStore();
  const {
    layoutMode,
    yStep,
    xZoom,
    radialPan,
    radialZoom,
    flatTree,
    previewFlatTree,
    collapsedNodes,
    selectedNodeId,
    showScaleBar,
    setSelectedNodeId,
    setFlatTree,
  } = useTreeStore();

  const [containerRef, containerWidth] = useContainerWidth();
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

  // Stable layout from committed flatTree — used for TreeLabels, panels, and dimensions.
  const layoutResult = useMemo(() => {
    if (!flatTree) return null;
    return buildLayout(flatTree, layoutMode, yStep, maxRadius, collapsedNodes);
  }, [flatTree, layoutMode, yStep, collapsedNodes, maxRadius]);

  const { svgRef, svgElRef, dropRow, svgDragging, wasDraggingRef, onPointerDown: onSvgPointerDown } =
    useTreeNodeDrag(layoutResult);

  // Preview layout from the transient drag preview tree — only for Branches rendering.
  // null when not dragging; falls back to layoutResult.
  const previewLayoutResult = useMemo(() => {
    if (!previewFlatTree) return null;
    return buildLayout(previewFlatTree, layoutMode, yStep, maxRadius, collapsedNodes);
  }, [previewFlatTree, layoutMode, yStep, maxRadius, collapsedNodes]);

  const handleNodeClick = useCallback(
    (node: LayoutNode, e: React.MouseEvent) => {
      if (wasDraggingRef.current) { wasDraggingRef.current = false; return; }
      e.preventDefault();
      setSelectedNodeId(node.id);
      setPanel({
        id: node.id,
        isLeaf: node.children.length === 0,
        leafName: node.children.length === 0 ? node.name : undefined,
        x: e.clientX,
        y: e.clientY,
      });
    },
    [setSelectedNodeId, wasDraggingRef],
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
      leafName: node.children.length === 0 ? node.name : undefined,
      x: e.clientX,
      y: e.clientY,
    });
  }, []);

  const handleCloseBranchPanel = useCallback(() => {
    setBranchPanel(null);
  }, []);

  const isStale = useNJStore((s) => s.isStale);
  const unmatchedLeafNames = useSequenceStore((s) => s.unmatchedLeafNames);
  const isRadial = layoutMode === "radial";

  const handleExportSVG = useCallback(() => {
    if (!svgElRef.current || !layoutResult) return;
    const mode = isRadial ? "radial" : "rect";
    const { nodeStyles, searchQuery, searchUseRegex, labelFontSize } = useTreeStore.getState();
    const svg = serializeTreeSVG(svgElRef.current, layoutResult, yStep, treeWidth, collapsedNodes, mode, {
      nodeStyles,
      searchQuery,
      searchUseRegex,
      selectedNodeId,
      labelFontSize,
    });
    downloadFile(svg, "tree.svg", "image/svg+xml");
  }, [layoutResult, yStep, treeWidth, collapsedNodes, isRadial, selectedNodeId, svgElRef]);

  const handleExportPNG = useCallback(async () => {
    if (!svgElRef.current || !layoutResult) return;
    const mode = isRadial ? "radial" : "rect";
    const { nodeStyles, searchQuery, searchUseRegex, labelFontSize } = useTreeStore.getState();
    const svg = serializeTreeSVG(svgElRef.current, layoutResult, yStep, treeWidth, collapsedNodes, mode, {
      nodeStyles,
      searchQuery,
      searchUseRegex,
      selectedNodeId,
      labelFontSize,
    });
    const png = await serializeTreePNG(svg);
    downloadFile(png, "tree.png", "image/png");
  }, [layoutResult, yStep, treeWidth, collapsedNodes, isRadial, selectedNodeId, svgElRef]);

  const handleExportNewick = useCallback(() => {
    if (!flatTree) return;
    downloadFile(flatTreeToNewick(flatTree), "tree.nwk", "text/plain");
  }, [flatTree]);

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
        <p className="text-destructive">Tree error: {error}</p>
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
  // During drag, show the preview topology in the SVG; labels and panels stay on stable layout.
  const displayRoot = previewLayoutResult?.root ?? layoutRoot;

  // For rect/cladogram, the zoomed SVG can exceed the container width.
  const svgWidth = isRadial
    ? MARGIN.left + treeWidth + MARGIN.right
    : MARGIN.left + treeWidth * xZoom + MARGIN.right;
  const svgHeight = isRadial
    ? (maxRadius + RADIAL_LABEL_GAP + 60) * 2 + MARGIN.top + MARGIN.bottom
    : nLeaves * yStep + MARGIN.top + MARGIN.bottom;

  const xScale = (maxDepth > 0 ? treeWidth / maxDepth : treeWidth) * xZoom;
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
        <Alert variant="warning" className="rounded-none py-1 px-3 flex-shrink-0">
          <AlertDescription className="text-xs">
            Alignment has been edited — re-run analysis to update the tree.
          </AlertDescription>
        </Alert>
      )}
      {unmatchedLeafNames.length > 0 && (
        <Alert variant="warning" className="rounded-none py-1 px-3 flex-shrink-0">
          <AlertDescription className="text-xs">
            {unmatchedLeafNames.length} tree{" "}
            {unmatchedLeafNames.length === 1 ? "leaf" : "leaves"} not found in
            alignment:{" "}
            {unmatchedLeafNames.length <= 3
              ? unmatchedLeafNames.join(", ")
              : `${unmatchedLeafNames.slice(0, 3).join(", ")} +${unmatchedLeafNames.length - 3} more`}
          </AlertDescription>
        </Alert>
      )}
      <TreeToolbar
        onExportSVG={handleExportSVG}
        onExportPNG={handleExportPNG}
        onExportNewick={handleExportNewick}
      />
      <div style={{ overflowY: "auto", overflowX: isRadial ? "hidden" : "auto", flex: 1 }}>
        <div className="flex">
          <svg
            ref={svgRef}
            data-testid="tree-rendered"
            width={svgWidth}
            height={svgHeight}
            style={{
              fontFamily: '"Azeret Mono", ui-monospace, monospace',
              display: "block",
              flexShrink: 0,
            }}
            onPointerDown={onSvgPointerDown}
            onClick={clearSelection}
          >
            <g transform={`translate(${MARGIN.left}, ${MARGIN.top})`}>
              {isRadial ? (
                <g transform={`translate(${radialPan.x}, ${radialPan.y}) scale(${radialZoom})`}>
                  <Branches
                    mode="radial"
                    node={displayRoot}
                    isRoot
                    parentR={0}
                    cx={radCx}
                    cy={radCy}
                    maxRadius={maxRadius}
                    onNodeClick={handleNodeClick}
                    onBranchClick={handleBranchClick}
                  />
                </g>
              ) : (
                <>
                  <Branches
                    mode="rect"
                    node={displayRoot}
                    isRoot
                    parentX={displayRoot.x}
                    xScale={xScale}
                    treeWidth={treeWidth}
                    yStep={yStep}
                    onNodeClick={handleNodeClick}
                    onBranchClick={handleBranchClick}
                  />
                  {showScaleBar && maxDepth > 0 && (
                    <ScaleBar
                      scaleVal={Math.max(0, maxDepth * 0.1)}
                      scalePx={Math.max(0, maxDepth * 0.1) * xScale}
                      nLeaves={nLeaves}
                    />
                  )}
                  {dropRow !== null && (
                    <line
                      x1={0}
                      y1={dropRow * yStep}
                      x2={treeWidth}
                      y2={dropRow * yStep}
                      stroke="currentColor"
                      strokeWidth={1.5}
                      opacity={0.5}
                      pointerEvents="none"
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
                <div className="w-px bg-border group-hover:bg-primary transition-colors" />
              </div>
              <TreeLabels
                layoutRoot={layoutRoot}
                previewLayoutRoot={svgDragging ? previewLayoutResult?.root : undefined}
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
