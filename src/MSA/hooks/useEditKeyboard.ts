import { useEffect } from "react";
import { useEditStore } from "../../editStore";
import { useDrawStore } from "../stores/drawStore";
import { useSequenceStore } from "../../sequenceStore";
import { currentToOriginalCol, currentDimensions } from "../../editUtils";

export default function useEditKeyboard() {
  const { addEdit, undo, redo } = useEditStore();
  const selectedIdentifier = useSequenceStore((s) => s.selectedIdentifier);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.shiftKey && e.key === "z") {
        e.preventDefault();
        redo();
        return;
      }
      if (mod && e.key === "z") {
        e.preventDefault();
        undo();
        return;
      }
      if (e.key === "Escape") {
        useDrawStore.getState().clearSelection();
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        const { selection } = useDrawStore.getState();
        const hasMulti = selection.rows.size + selection.columns.size > 0;
        if (hasMulti) {
          e.preventDefault();
          const { originalMSA, edits: editsSnapshot } = useEditStore.getState();
          const { rows, cols } = currentDimensions(originalMSA, editsSnapshot);
          // Refuse a bulk delete that would empty the alignment outright rather
          // than partially applying it (the store backstop would otherwise spare
          // the last row/column and leave a confusing remnant).
          if (selection.rows.size >= rows || selection.columns.size >= cols) return;
          const colsDesc = [...selection.columns].sort((a, b) => b - a); // descending
          for (const c of colsDesc) {
            addEdit({ type: "remove_column", originalIndex: currentToOriginalCol(c, editsSnapshot) });
          }
          for (const id of selection.rows) {
            addEdit({ type: "remove_row", originalId: id });
          }
          useDrawStore.getState().clearSelection();
          return;
        }
        if (selectedIdentifier) {
          e.preventDefault();
          addEdit({ type: "remove_row", originalId: selectedIdentifier });
        }
      }
    }

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [addEdit, undo, redo, selectedIdentifier]);
}
