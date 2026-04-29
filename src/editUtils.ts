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
