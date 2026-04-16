import type { JSX } from "react";
import { useTreeStore } from "../treeStore";
import type { LayoutNode, NodeId } from "../types";
import { MARGIN } from "../constants";
import { truncate } from "../layout";

type Props = {
  layoutRoot: LayoutNode;
  yStep: number;
  labelWidth: number;
  svgHeight: number;
};

function collectVisible(node: LayoutNode, collapsed: ReadonlySet<NodeId>): LayoutNode[] {
  if (collapsed.has(node.id)) return [node];
  if (node.children.length === 0) return [node];
  return node.children.flatMap((c) => collectVisible(c, collapsed));
}

export default function TreeLabels({ layoutRoot, yStep, labelWidth, svgHeight }: Props): JSX.Element {
  const collapsedNodes = useTreeStore((s) => s.collapsedNodes);
  const nodeStyles = useTreeStore((s) => s.nodeStyles);
  const selectedNodeId = useTreeStore((s) => s.selectedNodeId);

  const rows = collectVisible(layoutRoot, collapsedNodes);
  const maxChars = Math.max(6, Math.floor((labelWidth - 16) / 7));

  return (
    <div
      style={{
        position: "relative",
        width: labelWidth,
        height: svgHeight,
        flexShrink: 0,
        overflow: "hidden",
        fontFamily: '"Azeret Mono", ui-monospace, monospace',
        fontSize: 12,
      }}
    >
      {rows.map((entry) => {
        const isCollapsed = collapsedNodes.has(entry.id);
        const isLeaf = entry.children.length === 0;
        const styleKey = isLeaf ? `leaf:${entry.node.name}` : entry.id;
        const style = nodeStyles.get(styleKey);
        const isSelected = selectedNodeId === entry.id;

        const color = isSelected
          ? "oklch(var(--p))"
          : (style?.color ?? (isLeaf ? "#111" : "#555"));
        const fontWeight = style?.labelBold ? "bold" : "normal";
        const label = isCollapsed
          ? `${entry.leafCount} sequences`
          : truncate(entry.node.name, maxChars);

        return (
          <div
            key={entry.id}
            style={{
              position: "absolute",
              top: MARGIN.top + entry.y - yStep / 2,
              height: yStep,
              width: "100%",
              display: "flex",
              alignItems: "center",
              paddingLeft: 8,
              boxSizing: "border-box",
            }}
          >
            <span
              style={{
                color,
                fontWeight,
                fontStyle: isCollapsed ? "italic" : "normal",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
