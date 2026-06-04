import type { MSAData } from "./MSA/types";
import type { Edit, RemoveColEdit } from "./editStore";

export function applyEdits(original: MSAData, edits: Edit[]): MSAData {
  const removedRows = new Set(
    edits.filter((e): e is Extract<Edit, { type: "remove_row" }> => e.type === "remove_row")
      .map((e) => e.originalId)
  );
  const removedCols = edits
    .filter((e): e is RemoveColEdit => e.type === "remove_column")
    .map((e) => e.originalIndex)
    .sort((a, b) => b - a); // descending so splicing doesn't shift earlier indices

  return original
    .filter((s) => !removedRows.has(s.identifier))
    .map((s) => {
      if (removedCols.length === 0) return s;
      const chars = [...s.sequence];
      for (const col of removedCols) chars.splice(col, 1);
      return { identifier: s.identifier, sequence: chars.join("") };
    });
}

/**
 * Current alignment dimensions after applying the edit log, derived from counts
 * alone (no MSA materialization). Rows shrink by the distinct removed
 * identifiers, columns by the distinct removed original indices.
 */
export function currentDimensions(
  original: MSAData,
  edits: Edit[],
): { rows: number; cols: number } {
  if (original.length === 0) return { rows: 0, cols: 0 };
  const removedRows = new Set<string>();
  const removedCols = new Set<number>();
  for (const e of edits) {
    if (e.type === "remove_row") removedRows.add(e.originalId);
    else if (e.type === "remove_column") removedCols.add(e.originalIndex);
  }
  return {
    rows: original.length - removedRows.size,
    cols: original[0].sequence.length - removedCols.size,
  };
}

/**
 * Safeguard against emptying the alignment: returns false for a removal that
 * would delete the final remaining row or the final remaining column. Duplicate
 * removals (the row/column is already gone) and all non-removal edits pass
 * through unchanged. Enforced centrally in `editStore.addEdit`, so no deletion
 * path — bulk select, keyboard, or the per-row × button — can leave 0 rows or
 * 0 columns.
 */
export function canApplyRemoval(original: MSAData, edits: Edit[], edit: Edit): boolean {
  if (edit.type !== "remove_row" && edit.type !== "remove_column") return true;
  const { rows, cols } = currentDimensions(original, edits);
  if (edit.type === "remove_row") {
    const alreadyRemoved = edits.some(
      (e) => e.type === "remove_row" && e.originalId === edit.originalId,
    );
    return alreadyRemoved || rows > 1;
  }
  const alreadyRemoved = edits.some(
    (e) => e.type === "remove_column" && e.originalIndex === edit.originalIndex,
  );
  return alreadyRemoved || cols > 1;
}

export function resolveDisplayName(originalId: string, edits: Edit[]): string {
  let name = originalId;
  for (const e of edits) {
    if (e.type === "rename" && e.originalId === originalId) name = e.newName;
  }
  return name;
}

// Maps a visible (post-edit) column index to the original column index.
export function currentToOriginalCol(currentCol: number, edits: Edit[]): number {
  const removedOriginals = edits
    .filter((e): e is RemoveColEdit => e.type === "remove_column")
    .map((e) => e.originalIndex)
    .sort((a, b) => a - b); // ascending

  let visible = 0;
  for (let orig = 0; ; orig++) {
    if (removedOriginals.includes(orig)) continue;
    if (visible === currentCol) return orig;
    visible++;
  }
  // unreachable
  return currentCol;
}
