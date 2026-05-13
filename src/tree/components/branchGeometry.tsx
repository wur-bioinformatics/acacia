import type { JSX } from "react";
import type { BranchesProps, FlatNode, LayoutNode, NodeId, RadialGeomProps, RectGeomProps } from "../types";
import { useTreeStore } from "../treeStore";
import { truncate } from "../layout";
import { RADIAL_LABEL_GAP } from "../constants";

// ---------------------------------------------------------------------------
// Trigonometry primitives
// ---------------------------------------------------------------------------

export type Point = { x: number; y: number };

export function toCartesian(r: number, angle: number, cx: number, cy: number): Point {
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

export function arcPath(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
): string {
  const p1 = toCartesian(r, startAngle, cx, cy);
  const p2 = toCartesian(r, endAngle, cx, cy);
  const largeArc = Math.abs(endAngle - startAngle) > Math.PI ? 1 : 0;
  return `M ${p1.x},${p1.y} A ${r},${r} 0 ${largeArc},1 ${p2.x},${p2.y}`;
}

// ---------------------------------------------------------------------------
// Collapsed clade tooltip — shows up to 10 leaf names from the collapsed subtree.
// ---------------------------------------------------------------------------

function collectLeafNames(id: NodeId, nodes: Map<NodeId, FlatNode>): string[] {
  const node = nodes.get(id);
  if (!node) return [];
  if (node.childIds.length === 0) return [node.name];
  return node.childIds.flatMap((cid) => collectLeafNames(cid, nodes));
}

export function collapseTitle(nodeId: NodeId): string {
  const nodes = useTreeStore.getState().flatTree?.nodes;
  if (!nodes) return "";
  const names = collectLeafNames(nodeId, nodes);
  if (names.length <= 10) return names.join("\n");
  return `${names.slice(0, 10).join("\n")}\n…and ${names.length - 10} more`;
}

// ---------------------------------------------------------------------------
// Per-mode geometry — abstracts rect/cladogram/radial differences behind a
// uniform interface that the Branches component consumes.
// ---------------------------------------------------------------------------

export type Geometry = {
  nodePos: Point;
  parentPos: Point;
  childConnector: (node: LayoutNode, col: string, strokeWidth: number) => JSX.Element | null;
  collapseTriangle: (node: LayoutNode, nodePos: Point, fillCol: string) => JSX.Element;
  leafLabel: (
    node: LayoutNode,
    nodePos: Point,
    color: string,
    fontWeight: string,
    fontSize: number,
  ) => JSX.Element;
  bootstrapPos: (pos: Point) => Point;
  branchLengthLabel: (node: LayoutNode, parentPos: Point, nodePos: Point) => JSX.Element | null;
  childGeomProps: (node: LayoutNode) => RectGeomProps | RadialGeomProps;
};

function rectGeometry(props: BranchesProps & RectGeomProps): Geometry {
  const { node, parentX, xScale, treeWidth, yStep } = props;
  const x = node.x * xScale;
  const y = node.y;
  const px = parentX * xScale;
  return {
    nodePos: { x, y },
    parentPos: { x: px, y },
    childConnector: (n, col, strokeWidth) => {
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
          strokeWidth={strokeWidth}
        />
      );
    },
    collapseTriangle: (n, nPos, fillCol) => {
      const triHeight = Math.max(yStep * 0.75, n.leafCount * (yStep / 12));
      return (
        <polygon
          key={`tri-${n.id}`}
          points={`${nPos.x},${nPos.y} ${treeWidth},${nPos.y - triHeight / 2} ${treeWidth},${nPos.y + triHeight / 2}`}
          fill={fillCol}
          fillOpacity={0.35}
          stroke={fillCol}
          strokeWidth={0.5}
          style={{ cursor: "default" }}
        >
          <title>{collapseTitle(n.id)}</title>
        </polygon>
      );
    },
    leafLabel: () => <></>,
    bootstrapPos: (nPos: Point): Point => ({ x: nPos.x + 4.5, y: nPos.y + 3 }),
    branchLengthLabel: (n, pPos, nPos) => {
      if (n.length === 0) return null;
      const midX = (pPos.x + nPos.x) / 2;
      return (
        <text
          key={`bl-${n.id}`}
          x={midX}
          y={nPos.y - 2}
          fontSize={9}
          fill="#888"
          textAnchor="middle"
        >
          {n.length.toFixed(3)}
        </text>
      );
    },
    childGeomProps: () => ({
      mode: "rect",
      parentX: node.x,
      xScale,
      treeWidth,
      yStep,
    }),
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
    childConnector: (n, col, strokeWidth) => {
      if (n.children.length < 2) return null;
      const firstAngle = n.children[0].angle ?? 0;
      const lastAngle = n.children[n.children.length - 1].angle ?? 0;
      return (
        <path
          key={`arc-${n.id}`}
          d={arcPath(cx, cy, r, firstAngle, lastAngle)}
          fill="none"
          stroke={col}
          strokeWidth={strokeWidth}
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
          style={{ cursor: "default" }}
        >
          <title>{collapseTitle(n.id)}</title>
        </polygon>
      );
    },
    leafLabel: (n, _nodePos, color, fontWeight, fontSize) => {
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
          fontSize={fontSize}
          fill={color}
          textAnchor={anchor}
          dominantBaseline="central"
          fontWeight={fontWeight}
          transform={`rotate(${rotate}, ${labelPos.x}, ${labelPos.y})`}
        >
          {truncate(n.name, 24)}
        </text>
      );
    },
    bootstrapPos: () => toCartesian(r + 12, angle, cx, cy),
    branchLengthLabel: () => null,
    childGeomProps: () => ({ mode: "radial", parentR: r, cx, cy, maxRadius }),
  };
}

export function computeGeometry(props: BranchesProps): Geometry {
  if (props.mode === "rect")
    return rectGeometry(props as BranchesProps & RectGeomProps);
  return radialGeometry(props as BranchesProps & RadialGeomProps);
}
