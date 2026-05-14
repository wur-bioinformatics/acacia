import type { JSX } from "react";
import { branchKey } from "../layout";
import type { BranchesProps, RadialGeomProps } from "../types";
import { useTreeStore } from "../treeStore";
import { matchesQuery } from "../utils/search";
import { RADIAL_LABEL_GAP } from "../constants";
import NodeCircle from "./NodeCircle";
import { computeGeometry, toCartesian } from "./branchGeometry";

export default function Branches(props: BranchesProps): JSX.Element {
  const { node, isRoot, onNodeClick, onBranchClick } = props;

  const isLeaf = node.children.length === 0;
  const styleKey = isLeaf ? `leaf:${node.name}` : node.id;
  const styleColor = useTreeStore((s) => s.nodeStyles.get(styleKey)?.color);
  const styleBold = useTreeStore((s) => s.nodeStyles.get(styleKey)?.labelBold);
  const branchStyleColor = useTreeStore((s) => s.branchStyles.get(branchKey(node))?.color);
  const isCollapsed = useTreeStore((s) => s.collapsedNodes.has(node.id));
  const isSelected = useTreeStore((s) => s.selectedNodeId === node.id);
  const showBootstrap = useTreeStore((s) => s.showBootstrap);
  const bootstrapThreshold = useTreeStore((s) => s.bootstrapThreshold);
  const searchQuery = useTreeStore((s) => s.searchQuery);
  const searchUseRegex = useTreeStore((s) => s.searchUseRegex);
  const dragEnabled = useTreeStore((s) => s.dragEnabled);
  const branchWidth = useTreeStore((s) => s.branchWidth);
  const labelFontSize = useTreeStore((s) => s.labelFontSize);
  const nodeRadius = useTreeStore((s) => s.nodeRadius);
  const showBranchLengths = useTreeStore((s) => s.showBranchLengths);

  const leafName = isLeaf ? node.name : "";
  const searchActive = searchQuery.length > 0;
  const searchMatch = searchActive && matchesQuery(leafName, searchQuery, searchUseRegex);
  const searchOpacity = searchActive && isLeaf && !searchMatch ? 0.2 : 1;

  const branchCol = branchStyleColor ?? styleColor ?? "#333";
  const labelColor = styleColor ?? "#111";
  const fontWeight = styleBold ? "bold" : "normal";

  const geom = computeGeometry(props);
  const { nodePos, parentPos } = geom;

  const fillCol = styleColor ?? "#999";

  // Rect mode: extension line to label for uncollapsed leaves.
  const showExtLine = props.mode === "rect" && isLeaf && !isCollapsed;
  const treeWidth = props.mode === "rect" ? props.treeWidth : 0;

  // Collapsed-clade label: rect mode renders it via the TreeLabels DOM panel; radial stays in SVG.
  const collapseLabel = (() => {
    if (!isCollapsed || props.mode === "rect") return null;
    const angle = node.angle ?? 0;
    const { cx, cy, maxRadius } = props as RadialGeomProps;
    const labelR = maxRadius + RADIAL_LABEL_GAP;
    const labelPos = toCartesian(labelR, angle, cx, cy);
    const angleDeg = (angle * 180) / Math.PI;
    const flip = angle > Math.PI / 2 && angle < (3 * Math.PI) / 2;
    const rotate = flip ? angleDeg + 180 : angleDeg;
    const anchor = flip ? "end" : "start";
    return (
      <text
        key={`trlbl-${node.id}`}
        x={labelPos.x}
        y={labelPos.y}
        fontSize={10}
        fill={labelColor}
        textAnchor={anchor}
        dominantBaseline="central"
        transform={`rotate(${rotate}, ${labelPos.x}, ${labelPos.y})`}
      >
        {node.leafCount} taxa
      </text>
    );
  })();

  const bootstrapPos = geom.bootstrapPos(nodePos);
  const circleColor = styleColor ?? (isLeaf ? "#333" : "#555");

  // Bootstrap label visibility: requires master toggle + threshold pass. Internal-node `name`
  // holds the bootstrap value as a string; non-numeric names show only when threshold == 0.
  const bootstrapValue = parseFloat(node.name);
  const passesThreshold =
    bootstrapThreshold === 0 || (Number.isFinite(bootstrapValue) && bootstrapValue >= bootstrapThreshold);

  return (
    <g opacity={searchOpacity}>
      {isRoot && props.mode === "rect" && (
        <line
          key={`stub-${node.id}`}
          x1={nodePos.x - 18}
          y1={nodePos.y}
          x2={nodePos.x}
          y2={nodePos.y}
          stroke={branchCol}
          strokeWidth={branchWidth}
        />
      )}
      {!isRoot && (
        <>
          <line
            key={`hit-${node.id}`}
            x1={parentPos.x}
            y1={parentPos.y}
            x2={nodePos.x}
            y2={nodePos.y}
            stroke="transparent"
            strokeWidth={Math.max(8, branchWidth + 4)}
            style={{ cursor: "pointer" }}
            onClick={(e) => {
              e.stopPropagation();
              onBranchClick(node, e);
            }}
          />
          <line
            key={`br-${node.id}`}
            x1={parentPos.x}
            y1={parentPos.y}
            x2={nodePos.x}
            y2={nodePos.y}
            stroke={branchCol}
            strokeWidth={branchWidth}
          />
        </>
      )}
      {!isCollapsed && geom.childConnector(node, branchCol, branchWidth)}
      {!isCollapsed && showBootstrap && passesThreshold && node.name && !isRoot && !isLeaf && (
        <text
          key={`bs-${node.id}`}
          x={bootstrapPos.x}
          y={bootstrapPos.y}
          fontSize={props.mode === "rect" ? 9 : 8}
          fill="#999"
          textAnchor={props.mode === "radial" ? "middle" : undefined}
        >
          {node.name}
        </text>
      )}
      {showBranchLengths && !isRoot && geom.branchLengthLabel(node, parentPos, nodePos)}
      {!isCollapsed &&
        node.children.map((child) => (
          <Branches
            key={child.id}
            node={child}
            isRoot={false}
            onNodeClick={onNodeClick}
            onBranchClick={onBranchClick}
            {...geom.childGeomProps(child)}
          />
        ))}
      {isCollapsed && geom.collapseTriangle(node, nodePos, fillCol)}
      {isLeaf &&
        (isCollapsed
          ? collapseLabel
          : geom.leafLabel(node, nodePos, labelColor, fontWeight, labelFontSize - 1))}
      {showExtLine && (
        <line
          key={`ext-${node.id}`}
          x1={nodePos.x}
          y1={nodePos.y}
          x2={treeWidth}
          y2={nodePos.y}
          stroke="#ddd"
          strokeWidth={0.5}
          strokeDasharray="4 4"
        />
      )}
      <NodeCircle
        key={`circ-${node.id}`}
        cx={nodePos.x}
        cy={nodePos.y}
        r={isLeaf ? Math.max(0, nodeRadius - 1) : nodeRadius}
        isSelected={isSelected}
        color={searchMatch ? "#f59e0b" : circleColor}
        onClick={(e) => onNodeClick(node, e)}
        dataNodeId={!isCollapsed && !isRoot && dragEnabled ? node.id : undefined}
      />
    </g>
  );
}
