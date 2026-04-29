import { useEffect } from "react";
import { useEditStore } from "../../editStore";
import { useDrawStore } from "../stores/drawStore";
import { useSequenceStore } from "../../sequenceStore";
import { currentToOriginalCol } from "../../editUtils";

export default function useEditKeyboard() {
  const { addEdit, undo, redo, edits } = useEditStore();
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
        useDrawStore.getState().setSelectedColumn(null);
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        const { selectedColumn } = useDrawStore.getState();
        if (selectedColumn !== null) {
          e.preventDefault();
          addEdit({ type: "remove_column", originalIndex: currentToOriginalCol(selectedColumn, edits) });
          useDrawStore.getState().setSelectedColumn(null);
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
  }, [addEdit, undo, redo, selectedIdentifier, edits]);
}
