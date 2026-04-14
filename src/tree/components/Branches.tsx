import type { JSX } from "react";
import { truncate } from "../layout";
import type { BranchesProps, LayoutNode, RadialGeomProps, RectGeomProps } from "../types";
import { useTreeStore } from "../treeStore";
import { RADIAL_LABEL_GAP, Y_STEP } from "../constants";
import NodeCircle from "./NodeCircle";

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

type Point = { x: number; y: number };

function toCartesian(r: number, angle: number, cx: number, cy: number): Point {
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const p1 = toCartesian(r, startAngle, cx, cy);
  const p2 = toCartesian(r, endAngle, cx, cy);
  const largeArc = Math.abs(endAngle - startAngle) > Math.PI ? 1 : 0;
  return `M ${p1.x},${p1.y} A ${r},${r} 0 ${largeArc},1 ${p2.x},${p2.y}`;
}

// ---------------------------------------------------------------------------
// Per-mode geometry
// ---------------------------------------------------------------------------

type Geometry = {
  nodePos: Point;
  parentPos: Point;
  childConnector: (node: LayoutNode, col: string) => JSX.Element | null;
  collapseTriangle: (node: LayoutNode, nodePos: Point, fillCol: string) => JSX.Element;
  leafLabel: (node: LayoutNode, nodePos: Point, color: string, fontWeight: string) => JSX.Element;
  bootstrapPos: () => Point;
  childGeomProps: () => RectGeomProps | RadialGeomProps;
};

function rectGeometry(props: BranchesProps & RectGeomProps): Geometry {
  const { node, parentX, xScale, treeWidth } = props;
  const x = node.x * xScale;
  const y = node.y;
  const px = parentX * xScale;
  return {
    nodePos: { x, y },
    parentPos: { x: px, y },
    childConnector: (n, col) => {
      if (n.children.length < 2) return null;
      const topY = n.children[0].y;
      const botY = n.children[n.children.length - 1].y;
      return (
        <line
          key={`v-${n.id}`}
          x1={x}
          y1={topY}
          x2={x}
          y2={botY}
          stroke={col}
          strokeWidth={1}
        />
      );
    },
    collapseTriangle: (n, nPos, fillCol) => {
      const triHeight = Math.max(Y_STEP * 2, n.leafCount * (Y_STEP / 3));
      return (
        <polygon
          key={`tri-${n.id}`}
          points={`${nPos.x},${nPos.y} ${treeWidth},${nPos.y - triHeight / 2} ${treeWidth},${nPos.y + triHeight / 2}`}
          fill={fillCol}
          fillOpacity={0.35}
          stroke={fillCol}
          strokeWidth={0.5}
        />
      );
    },
    leafLabel: (n, nPos, color, fontWeight) => (
      <text
        key={`lbl-${n.id}`}
        x={treeWidth + 24}
        y={nPos.y}
        fontSize={12}
        fill={color}
        dominantBaseline="central"
        fontWeight={fontWeight}
      >
        {truncate(n.node.name)}
      </text>
    ),
    bootstrapPos: (nPos) => ({ x: nPos.x + 3, y: nPos.y - 3 }),
    childGeomProps: () => ({ mode: "rect", parentX: node.x, xScale, treeWidth }),
  };
}

function radialGeometry(props: BranchesProps & RadialGeomProps): Geometry {
  const { node, parentR, cx, cy, maxRadius } = props;
  const angle = node.angle ?? 0;
  const r = node.x;
  const nodePos = toCartesian(r, angle, cx, cy);
  const parentPos = toCartesian(parentR, angle, cx, cy);
  return {
    nodePos,
    parentPos,
    childConnector: (n, col) => {
      if (n.children.length < 2) return null;
      const firstAngle = n.children[0].angle ?? 0;
      const lastAngle = n.children[n.children.length - 1].angle ?? 0;
      return (
        <path
          key={`arc-${n.id}`}
          d={arcPath(cx, cy, r, firstAngle, lastAngle)}
          fill="none"
          stroke={col}
          strokeWidth={1}
        />
      );
    },
    collapseTriangle: (n, nPos, fillCol) => {
      const spread = Math.min(Math.PI / 6, (n.leafCount / 20) * (Math.PI / 6));
      const p1 = toCartesian(maxRadius, angle - spread / 2, cx, cy);
      const p2 = toCartesian(maxRadius, angle + spread / 2, cx, cy);
      return (
        <polygon
          key={`tri-${n.id}`}
          points={`${nPos.x},${nPos.y} ${p1.x},${p1.y} ${p2.x},${p2.y}`}
          fill={fillCol}
          fillOpacity={0.35}
          stroke={fillCol}
          strokeWidth={0.5}
        />
      );
    },
    leafLabel: (n, _nodePos, color, fontWeight) => {
      const labelR = maxRadius + RADIAL_LABEL_GAP;
      const labelPos = toCartesian(labelR, angle, cx, cy);
      const angleDeg = (angle * 180) / Math.PI;
      const flip = angle > Math.PI / 2 && angle < (3 * Math.PI) / 2;
      const rotate = flip ? angleDeg + 180 : angleDeg;
      const anchor = flip ? "end" : "start";
      return (
        <text
          key={`lbl-${n.id}`}
          x={labelPos.x}
          y={labelPos.y}
          fontSize={11}
          fill={color}
          textAnchor={anchor}
          dominantBaseline="central"
          fontWeight={fontWeight}
          transform={`rotate(${rotate}, ${labelPos.x}, ${labelPos.y})`}
        >
          {truncate(n.node.name, 24)}
        </text>
      );
    },
    bootstrapPos: () => toCartesian(r + 6, angle, cx, cy),
    childGeomProps: () => ({ mode: "radial", parentR: r, cx, cy, maxRadius }),
  };
}

function computeGeometry(props: BranchesProps): Geometry {
  if (props.mode === "rect") return rectGeometry(props as BranchesProps & RectGeomProps);
  return radialGeometry(props as BranchesProps & RadialGeomProps);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Branches(props: BranchesProps): JSX.Element {
  const { node, isRoot, onNodeClick, didDragRef } = props;

  const isLeaf = node.children.length === 0;
  const styleKey = isLeaf ? `leaf:${node.node.name}` : node.id;
  const styleColor = useTreeStore((s) => s.nodeStyles.get(styleKey)?.color);
  const styleBold = useTreeStore((s) => s.nodeStyles.get(styleKey)?.labelBold);
  const isCollapsed = useTreeStore((s) => s.collapsedNodes.has(node.id));
  const isSelected = useTreeStore((s) => s.selectedNodeId === node.id);
  const showBootstrap = useTreeStore((s) => s.showBootstrap);
  const rerootOnBranch = useTreeStore((s) => s.rerootOnBranch);

  const branchCol = styleColor ?? "#333";
  const labelColor = styleColor ?? "#111";
  const fontWeight = styleBold ? "bold" : "normal";

  const geom = computeGeometry(props);
  const { nodePos, parentPos } = geom;

  const showCollapse = isCollapsed || isLeaf;
  const fillCol = styleColor ?? "#999";

  // Rect mode: extension line to label for uncollapsed leaves
  const showExtLine = props.mode === "rect" && isLeaf && !isCollapsed;
  const treeWidth = props.mode === "rect" ? props.treeWidth : 0;

  // Collapsed label (shared between rect and radial with mode-specific positioning)
  const collapseLabel = (() => {
    if (!isCollapsed) return null;
    if (props.mode === "rect") {
      return (
        <text
          key={`trlbl-${node.id}`}
          x={treeWidth + 6}
          y={nodePos.y}
          fontSize={11}
          fill={labelColor}
          dominantBaseline="central"
          fontWeight={fontWeight}
          fontStyle="italic"
        >
          {node.leafCount} taxa
        </text>
      );
    }
    // radial
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

  return (
    <>
      {isRoot && props.mode === "rect" && (
        <line
          key={`stub-${node.id}`}
          x1={nodePos.x - 18}
          y1={nodePos.y}
          x2={nodePos.x}
          y2={nodePos.y}
          stroke={branchCol}
          strokeWidth={1}
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
            strokeWidth={8}
            style={{ cursor: "crosshair" }}
            onClick={(e) => {
              if (didDragRef.current) return;
              e.stopPropagation();
              rerootOnBranch(node.id);
            }}
          />
          <line
            key={`br-${node.id}`}
            x1={parentPos.x}
            y1={parentPos.y}
            x2={nodePos.x}
            y2={nodePos.y}
            stroke={branchCol}
            strokeWidth={1}
          />
        </>
      )}
      {!showCollapse && geom.childConnector(node, branchCol)}
      {!showCollapse && showBootstrap && node.node.name && !isRoot && (
        <text
          key={`bs-${node.id}`}
          x={bootstrapPos.x}
          y={bootstrapPos.y}
          fontSize={props.mode === "rect" ? 9 : 8}
          fill="#999"
          textAnchor={props.mode === "radial" ? "middle" : undefined}
        >
          {node.node.name}
        </text>
      )}
      {!showCollapse &&
        node.children.map((child) => (
          <Branches
            key={child.id}
            node={child}
            isRoot={false}
            onNodeClick={onNodeClick}
            didDragRef={didDragRef}
            {...geom.childGeomProps(child)}
          />
        ))}
      {showCollapse && geom.collapseTriangle(node, nodePos, fillCol)}
      {showCollapse && (isCollapsed ? collapseLabel : geom.leafLabel(node, nodePos, labelColor, fontWeight))}
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
        r={isLeaf ? 2 : 3}
        isSelected={isSelected}
        color={circleColor}
        didDragRef={didDragRef}
        onClick={(e) => onNodeClick(node, e)}
      />
    </>
  );
}
