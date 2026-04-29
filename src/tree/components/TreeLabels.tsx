import { useState, type JSX } from "react";
import { useTreeStore } from "../treeStore";
import type { LayoutNode, NodeId } from "../types";
import { MARGIN } from "../constants";
import { truncate } from "../layout";
import { useEditStore } from "../../editStore";
import { resolveDisplayName } from "../../editUtils";
import { useShallow } from "zustand/react/shallow";

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
  const { edits, addEdit } = useEditStore(
    useShallow((s) => ({ edits: s.edits, addEdit: s.addEdit }))
  );

  const [renamingId, setRenamingId] = useState<string | null>(null); // original leaf name
  const [draft, setDraft] = useState("");

  const rows = collectVisible(layoutRoot, collapsedNodes);
  const maxChars = Math.max(6, Math.floor((labelWidth - 16) / 7));

  function commitRename(originalId: string) {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== resolveDisplayName(originalId, edits)) {
      addEdit({ type: "rename", originalId, newName: trimmed });
    }
    setRenamingId(null);
  }

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
        const isRenaming = isLeaf && !isCollapsed && renamingId === entry.node.name;

        const color = isSelected
          ? "oklch(var(--p))"
          : (style?.color ?? (isLeaf ? "#111" : "#555"));
        const fontWeight = style?.labelBold ? "bold" : "normal";

        const displayName = isLeaf
          ? resolveDisplayName(entry.node.name, edits)
          : entry.node.name;
        const label = isCollapsed
          ? `${entry.leafCount} sequences`
          : truncate(displayName, maxChars);

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
            {isRenaming ? (
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => commitRename(entry.node.name)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename(entry.node.name);
                  if (e.key === "Escape") setRenamingId(null);
                  e.stopPropagation();
                }}
                style={{
                  fontSize: 12,
                  fontFamily: '"Azeret Mono", ui-monospace, monospace',
                  width: "calc(100% - 8px)",
                  background: "var(--color-base-100)",
                  border: "1px solid var(--color-base-300)",
                  borderRadius: 2,
                  padding: "0 4px",
                  height: Math.min(yStep - 2, 18),
                  color,
                  fontWeight,
                }}
              />
            ) : (
              <span
                onDoubleClick={
                  isLeaf && !isCollapsed
                    ? (e) => {
                        e.stopPropagation();
                        setRenamingId(entry.node.name);
                        setDraft(displayName);
                      }
                    : undefined
                }
                style={{
                  color,
                  fontWeight,
                  fontStyle: isCollapsed ? "italic" : "normal",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  cursor: isLeaf && !isCollapsed ? "text" : "default",
                }}
              >
                {label}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
