import { useMemo } from "react";
import type { JSX } from "react";
import { useContainerWidth } from "../hooks/useContainerWidth";
import { useNJStore } from "../NJ/njStore";

type TreeNode = {
  name: string;
  length: number;
  children: TreeNode[];
};

type LayoutNode = {
  node: TreeNode;
  x: number; // cumulative distance from root
  y: number; // leaf index or midpoint of children
  children: LayoutNode[];
};

function parseNewick(s: string): TreeNode {
  let i = 0;

  function parseNode(): TreeNode {
    const node: TreeNode = { name: "", length: 0, children: [] };

    while (i < s.length && " \t\n\r".includes(s[i])) i++;

    if (i < s.length && s[i] === "(") {
      i++; // consume '('
      node.children.push(parseNode());
      while (i < s.length && s[i] === ",") {
        i++; // consume ','
        node.children.push(parseNode());
      }
      if (i < s.length && s[i] === ")") i++; // consume ')'
    }

    // parse name (stops at ':', ',', ')', ';')
    while (i < s.length && " \t".includes(s[i])) i++;
    const nameStart = i;
    while (i < s.length && !":,);".includes(s[i])) i++;
    node.name = s.slice(nameStart, i).trim();

    // parse branch length
    if (i < s.length && s[i] === ":") {
      i++;
      const lenStart = i;
      while (i < s.length && !",);".includes(s[i])) i++;
      node.length = parseFloat(s.slice(lenStart, i)) || 0;
    }

    return node;
  }

  return parseNode();
}

function buildLayout(root: TreeNode): {
  layout: LayoutNode;
  nLeaves: number;
  maxDepth: number;
} {
  let leafIdx = 0;
  let maxDepth = 0;

  function build(node: TreeNode, depth: number): LayoutNode {
    const children = node.children.map((c) => build(c, depth + c.length));
    let y: number;
    if (children.length === 0) {
      y = leafIdx++;
      if (depth > maxDepth) maxDepth = depth;
    } else {
      y = (children[0].y + children[children.length - 1].y) / 2;
    }
    return { node, x: depth, y, children };
  }

  const layout = build(root, 0);
  return { layout, nLeaves: leafIdx, maxDepth };
}

function truncate(s: string, max = 32): string {
  return s.length > max ? s.slice(0, max) + "…" : s;
}

function collectElements(
  node: LayoutNode,
  parentX: number,
  xScale: number,
  yScale: number,
  treeWidth: number,
  isRoot: boolean,
  id: string,
): JSX.Element[] {
  const elements: JSX.Element[] = [];
  const x = node.x * xScale;
  const y = node.y * yScale;
  const px = parentX * xScale;

  if (isRoot) {
    // small stub to the left of the root
    elements.push(
      <line key={`stub-${id}`} x1={x - 18} y1={y} x2={x} y2={y} stroke="#333" strokeWidth={1} />,
    );
  } else {
    // horizontal branch from parent to this node
    elements.push(
      <line key={`h-${id}`} x1={px} y1={y} x2={x} y2={y} stroke="#333" strokeWidth={1} />,
    );
  }

  if (node.children.length > 0) {
    // vertical connector between first and last child
    const topY = node.children[0].y * yScale;
    const botY = node.children[node.children.length - 1].y * yScale;
    elements.push(
      <line key={`v-${id}`} x1={x} y1={topY} x2={x} y2={botY} stroke="#333" strokeWidth={1} />,
    );

    // bootstrap / internal node label
    if (node.node.name) {
      elements.push(
        <text key={`bs-${id}`} x={x + 3} y={y - 3} fontSize={9} fill="#999">
          {node.node.name}
        </text>,
      );
    }

    node.children.forEach((child, ci) => {
      elements.push(
        ...collectElements(child, node.x, xScale, yScale, treeWidth, false, `${id}-${ci}`),
      );
    });
  } else {
    // dotted extension line to the right edge (aligns all labels)
    elements.push(
      <line
        key={`ext-${id}`}
        x1={x}
        y1={y}
        x2={treeWidth}
        y2={y}
        stroke="#ddd"
        strokeWidth={0.5}
        strokeDasharray="4 4"
      />,
    );
    // leaf label
    elements.push(
      <text
        key={`lbl-${id}`}
        x={treeWidth + 6}
        y={y}
        fontSize={12}
        fill="#111"
        dominantBaseline="central"
      >
        {truncate(node.node.name)}
      </text>,
    );
  }

  return elements;
}

const LABEL_WIDTH = 240;
const MARGIN = { top: 15, right: 10, bottom: 45, left: 30 };
const Y_STEP = 22;

export default function Tree(): JSX.Element {
  const { newick, status, error } = useNJStore();

  const [containerRef, containerWidth] = useContainerWidth();

  const parsed = useMemo(() => {
    if (!newick) return null;
    try {
      const root = parseNewick(newick);
      return buildLayout(root);
    } catch {
      return null;
    }
  }, [newick]);

  if (status === "running") {
    return <div ref={containerRef}><p className="opacity-60">Computing Neighbor-Joining tree…</p></div>;
  }
  if (status === "error") {
    return <div ref={containerRef}><p className="text-error">Tree error: {error}</p></div>;
  }
  if (!parsed) {
    return <div ref={containerRef}><p className="opacity-60">No tree computed yet.</p></div>;
  }
  const treeWidth = containerWidth > 0
    ? Math.max(200, containerWidth - MARGIN.left - LABEL_WIDTH - MARGIN.right)
    : 560;
  const svgWidth = containerWidth > 0 ? containerWidth : 870;

  const { layout, nLeaves, maxDepth } = parsed;
  const xScale = maxDepth > 0 ? treeWidth / maxDepth : treeWidth;
  const svgHeight = nLeaves * Y_STEP + MARGIN.top + MARGIN.bottom;

  const elements = collectElements(layout, layout.x, xScale, Y_STEP, treeWidth, true, "r");

  const scaleVal = maxDepth > 0 ? parseFloat((maxDepth * 0.1).toPrecision(2)) : 0;
  const scalePx = scaleVal * xScale;

  return (
    <div ref={containerRef} style={{ overflowX: "auto" }}>
      <svg
        width={svgWidth}
        height={svgHeight}
        style={{ fontFamily: "ui-monospace, monospace" }}
      >
        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
          {elements}
          {maxDepth > 0 && (
            <g transform={`translate(0,${nLeaves * Y_STEP + 18})`}>
              <line x1={0} y1={0} x2={scalePx} y2={0} stroke="#555" strokeWidth={1.5} />
              <line x1={0} y1={-4} x2={0} y2={4} stroke="#555" strokeWidth={1.5} />
              <line x1={scalePx} y1={-4} x2={scalePx} y2={4} stroke="#555" strokeWidth={1.5} />
              <text x={scalePx / 2} y={14} textAnchor="middle" fontSize={10} fill="#666">
                {scaleVal}
              </text>
            </g>
          )}
        </g>
      </svg>
    </div>
  );
}
