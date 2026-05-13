import type { FlatNode, FlatTree, LayoutNode, NodeId } from "../types";

export function getLayoutLeafNames(node: LayoutNode): string[] {
  if (node.children.length === 0) return [node.name];
  return node.children.flatMap(getLayoutLeafNames);
}

export function getAllLeafNames(id: NodeId, nodes: Map<NodeId, FlatNode>): string[] {
  const node = nodes.get(id)!;
  if (node.childIds.length === 0) return [node.name];
  return node.childIds.flatMap((cid) => getAllLeafNames(cid, nodes));
}

export function collectVisible(node: LayoutNode, collapsed: ReadonlySet<NodeId>): LayoutNode[] {
  if (collapsed.has(node.id)) return [node];
  if (node.children.length === 0) return [node];
  return node.children.flatMap((c) => collectVisible(c, collapsed));
}

// Single source of truth for "given a drag, compute the result".
// Used by both SVG-circle drag (useTreeNodeDrag) and label-row drag (TreeLabels).
//
// Contract:
//   - draggedNodeId: the dragged node (root of the moved subtree).
//   - toRowIndex: the target row in `visibleRows`. Clamped to [0, visibleRows.length-1].
//   - Returns null when the drag is a no-op:
//       (a) toRowIndex falls inside the dragged group's vertical extent — no movement intent yet
//       (b) target leaf cannot be located
//       (c) the resulting order equals the current order
//   - Otherwise returns a `DragPlan` with both the new leaf order (for rotation-based commit
//     and preview) AND the SPR triple (movedNodeId, targetNodeId, insertAfter) for the
//     topology-changing commit path used when rotation alone can't realize newLeafOrder.
export type DragPlanInput = {
  flatTree: FlatTree;
  visibleRows: LayoutNode[];
  draggedNodeId: NodeId;
  toRowIndex: number;
};

export type DragPlan = {
  newLeafOrder: string[];
  movedNodeId: NodeId;
  targetNodeId: NodeId;
  insertAfter: boolean;
};

export function planLeafReorder(input: DragPlanInput): DragPlan | null {
  const { flatTree, visibleRows, draggedNodeId, toRowIndex } = input;
  if (visibleRows.length === 0) return null;

  const movedFlatNode = flatTree.nodes.get(draggedNodeId);
  if (!movedFlatNode) return null;
  const draggedLeafNames = getAllLeafNames(draggedNodeId, flatTree.nodes);
  if (draggedLeafNames.length === 0) return null;

  const draggedSet = new Set(draggedLeafNames);
  const allLeafNames = flatTree.leafOrder.map((id) => flatTree.nodes.get(id)!.name);

  // Locate the contiguous block of visible rows whose leaves are all in the dragged set.
  let groupStart = visibleRows.length;
  let groupEnd = -1;
  for (let i = 0; i < visibleRows.length; i++) {
    const rowLeafs = getAllLeafNames(visibleRows[i].id, flatTree.nodes);
    if (rowLeafs.length > 0 && rowLeafs.every((n) => draggedSet.has(n))) {
      if (i < groupStart) groupStart = i;
      if (i > groupEnd) groupEnd = i;
    }
  }
  if (groupStart > groupEnd) return null;

  const target = Math.max(0, Math.min(visibleRows.length - 1, toRowIndex));

  // Inside the dragged group's extent — no movement intent yet. Caller keeps last preview.
  if (target >= groupStart && target <= groupEnd) return null;

  const targetRow = visibleRows[target];
  const targetLeafs = getAllLeafNames(targetRow.id, flatTree.nodes);
  if (targetLeafs.length === 0) return null;
  const insertBefore = target < groupStart;
  const anchorLeaf = insertBefore ? targetLeafs[0] : targetLeafs[targetLeafs.length - 1];

  const without = allLeafNames.filter((n) => !draggedSet.has(n));
  const at = without.indexOf(anchorLeaf);
  if (at === -1) return null;
  const insertAt = insertBefore ? at : at + 1;
  const result = [...without];
  result.splice(insertAt, 0, ...draggedLeafNames);

  if (result.length === allLeafNames.length && result.every((n, i) => n === allLeafNames[i])) {
    return null;
  }
  return {
    newLeafOrder: result,
    movedNodeId: draggedNodeId,
    targetNodeId: targetRow.id,
    insertAfter: !insertBefore,
  };
}
