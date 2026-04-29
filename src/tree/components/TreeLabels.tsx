import { type JSX } from "react";
import { useTreeStore } from "../treeStore";
import type { FlatNode, LayoutNode, NodeId } from "../types";
import { MARGIN } from "../constants";
import { useSequenceStore } from "../../sequenceStore";
import { rotateFlatToOrder } from "../layout";
import SequenceLabels, { type LabelEntry } from "../../SequenceLabels";

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

function firstLeafName(id: NodeId, nodes: Map<NodeId, FlatNode>): string {
  const node = nodes.get(id)!;
  if (node.childIds.length === 0) return node.name;
  return firstLeafName(node.childIds[0], nodes);
}

function lastLeafName(id: NodeId, nodes: Map<NodeId, FlatNode>): string {
  const node = nodes.get(id)!;
  if (node.childIds.length === 0) return node.name;
  return lastLeafName(node.childIds[node.childIds.length - 1], nodes);
}

export default function TreeLabels({ layoutRoot, yStep, labelWidth, svgHeight }: Props): JSX.Element {
  const collapsedNodes = useTreeStore((s) => s.collapsedNodes);
  const nodeStyles = useTreeStore((s) => s.nodeStyles);
  const selectedNodeId = useTreeStore((s) => s.selectedNodeId);
  const flatTree = useTreeStore((s) => s.flatTree);
  const rotateLeavesToOrder = useTreeStore((s) => s.rotateLeavesToOrder);
  const setPreviewFlatTree = useTreeStore((s) => s.setPreviewFlatTree);

  // rows and entries are derived from the stable layoutRoot (committed flatTree),
  // not from the preview — this keeps drag interaction indices stable during preview.
  const rows = collectVisible(layoutRoot, collapsedNodes);

  const entries: LabelEntry[] = rows.map((entry) => {
    const isCollapsed = collapsedNodes.has(entry.id);
    const isLeaf = entry.children.length === 0;
    const styleKey = isLeaf ? `leaf:${entry.node.name}` : entry.id;
    const style = nodeStyles.get(styleKey);
    const isSelected = selectedNodeId === entry.id;

    const color = isSelected
      ? "oklch(var(--p))"
      : (style?.color ?? (isLeaf ? undefined : "#555"));
    const fontWeight = style?.labelBold ? "bold" : undefined;
    const fontStyle = isCollapsed ? "italic" : undefined;

    return {
      id: entry.node.name,
      label: isCollapsed ? `${entry.leafCount} sequences` : undefined,
      draggable: isLeaf && !isCollapsed,
      entryStyle: { color, fontWeight, fontStyle },
    };
  });

  // Map a row index → a leaf name in fullLeafNames order.
  // useLastLeaf: for collapsed nodes, use the last leaf (when dragging down) so the
  // dragged item lands after the collapsed group, not inside it.
  function rowToLeafName(rowIdx: number, nodes: Map<NodeId, FlatNode>, useLastLeaf: boolean): string {
    const row = rows[rowIdx];
    // Use flatTree childIds to distinguish true leaves from collapsed internal nodes.
    // Collapsed nodes have row.children === [] in the layout (treated as leaves for rendering),
    // but their flatTree childIds are non-empty. Using row.children.length would return the
    // internal node's name (not a leaf name), causing indexOf to return -1 and aborting the drag.
    const flatNode = nodes.get(row.id)!;
    if (flatNode.childIds.length === 0) return row.node.name;
    return useLastLeaf ? lastLeafName(row.id, nodes) : firstLeafName(row.id, nodes);
  }

  // Compute the desired leaf name array for a given (from, to) row move.
  // Uses the stable flatTree so drag indices stay valid across preview updates.
  function computeNewOrder(from: number, to: number): string[] | null {
    if (!flatTree || from === to) return null;
    const { nodes, leafOrder } = flatTree;
    const fullLeafNames = leafOrder.map((id) => nodes.get(id)!.name);

    const fromLeafName = rowToLeafName(from, nodes, false);
    // When dragging down (from < to), use the last leaf of collapsed groups so the
    // dragged item is inserted after the group, not at its start.
    const toLeafName = rowToLeafName(to, nodes, from < to);

    const fromIdx = fullLeafNames.indexOf(fromLeafName);
    const toIdx = fullLeafNames.indexOf(toLeafName);
    if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return null;

    // Mirror moveSequence: remove from fromIdx, insert at toIdx in the shortened array.
    // Using the original toIdx (not re-found after splice) matches the MSA direction behaviour.
    const newOrder = [...fullLeafNames];
    const [item] = newOrder.splice(fromIdx, 1);
    newOrder.splice(toIdx, 0, item);
    return newOrder;
  }

  function handleReorder(from: number, to: number) {
    const newOrder = computeNewOrder(from, to);
    if (!newOrder) return;
    rotateLeavesToOrder(newOrder);  // commits + clears previewFlatTree
    useSequenceStore.getState().syncFromTreeLeafOrder(newOrder);
  }

  function handleDragChange(state: { dragIndex: number; hoverIndex: number } | null) {
    if (!flatTree || state === null) {
      setPreviewFlatTree(null);
      return;
    }
    const newOrder = computeNewOrder(state.dragIndex, state.hoverIndex);
    if (!newOrder) {
      setPreviewFlatTree(null);
      return;
    }
    setPreviewFlatTree(rotateFlatToOrder(flatTree, newOrder));
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
