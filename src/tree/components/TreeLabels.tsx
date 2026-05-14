import { type JSX } from "react";
import { useTreeStore } from "../treeStore";
import type { LayoutNode } from "../types";
import { MARGIN } from "../constants";
import { useSequenceStore } from "../../sequenceStore";
import { rotateFlatToOrder } from "../layout";
import SequenceLabels, { type LabelEntry } from "../../SequenceLabels";
import { collectVisible, planLeafReorder, type DragPlan } from "../utils/drag";
import { matchesQuery } from "../utils/search";

type Props = {
  layoutRoot: LayoutNode;
  previewLayoutRoot?: LayoutNode;
  yStep: number;
  labelWidth: number;
  svgHeight: number;
};

export default function TreeLabels({ layoutRoot, previewLayoutRoot, yStep, labelWidth, svgHeight }: Props): JSX.Element {
  const collapsedNodes = useTreeStore((s) => s.collapsedNodes);
  const nodeStyles = useTreeStore((s) => s.nodeStyles);
  const selectedNodeId = useTreeStore((s) => s.selectedNodeId);
  const flatTree = useTreeStore((s) => s.flatTree);
  const rotateLeavesToOrder = useTreeStore((s) => s.rotateLeavesToOrder);
  const setPreviewFlatTree = useTreeStore((s) => s.setPreviewFlatTree);
  const searchQuery = useTreeStore((s) => s.searchQuery);
  const searchUseRegex = useTreeStore((s) => s.searchUseRegex);

  // rows: stable (committed) layout — used for drag-interaction index mapping.
  // displayRows: preview layout during SVG node drag, stable otherwise.
  const rows = collectVisible(layoutRoot, collapsedNodes);
  const displayRows = previewLayoutRoot ? collectVisible(previewLayoutRoot, collapsedNodes) : rows;

  const searchActive = searchQuery.length > 0;

  const entries: LabelEntry[] = displayRows.map((entry) => {
    const isCollapsed = collapsedNodes.has(entry.id);
    const isLeaf = entry.children.length === 0;
    const styleKey = isLeaf ? `leaf:${entry.name}` : entry.id;
    const style = nodeStyles.get(styleKey);
    const isSelected = selectedNodeId === entry.id;
    const label = isCollapsed ? `${entry.leafCount} sequences` : undefined;
    const displayName = label ?? entry.name;
    const searchMatch =
      searchActive && matchesQuery(displayName, searchQuery, searchUseRegex);

    const color = isSelected
      ? "oklch(var(--p))"
      : (style?.color ?? (isLeaf ? undefined : "#555"));
    const fontWeight = style?.labelBold || searchMatch ? "bold" : undefined;
    const fontStyle = isCollapsed ? "italic" : undefined;
    const opacity = searchActive && !searchMatch ? 0.2 : undefined;

    return {
      id: entry.name,
      label,
      draggable: isLeaf || isCollapsed,
      entryStyle: { color, fontWeight, fontStyle, opacity },
    };
  });

  function computePlan(from: number, to: number): DragPlan | null {
    if (!flatTree || from === to) return null;
    return planLeafReorder({
      flatTree,
      visibleRows: rows,
      draggedNodeId: rows[from].id,
      toRowIndex: to,
    });
  }

  function handleReorder(from: number, to: number) {
    const plan = computePlan(from, to);
    if (!plan) return;
    rotateLeavesToOrder(plan.newLeafOrder);
    useSequenceStore.getState().syncFromTreeLeafOrder(plan.newLeafOrder);
  }

  function handleDragChange(state: { dragIndex: number; hoverIndex: number } | null) {
    if (!flatTree || state === null) {
      setPreviewFlatTree(null);
      return;
    }
    const plan = computePlan(state.dragIndex, state.hoverIndex);
    if (!plan) {
      setPreviewFlatTree(null);
      return;
    }
    setPreviewFlatTree(rotateFlatToOrder(flatTree, plan.newLeafOrder));
  }

  return (
    <SequenceLabels
      entries={entries}
      rowHeight={yStep}
      width={labelWidth}
      containerHeight={svgHeight}
      paddingTop={MARGIN.top - yStep / 2}
      textAlign="left"
      fontSize={12}
      animateShifts={false}
      onReorder={handleReorder}
      onDragChange={handleDragChange}
    />
  );
}
