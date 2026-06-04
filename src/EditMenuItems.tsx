import type { JSX } from "react";
import { useShallow } from "zustand/react/shallow";
import { useEditStore } from "./editStore";
import {
  DropdownMenuItem,
  DropdownMenuShortcut,
} from "@/components/ui/dropdown-menu";

// Undo / redo / export of the cross-module edit log (rename, remove row/column).
// Rendered inside the "Edit" dropdown of every view so the same edit history is
// reachable from MSA, tree, and distance-matrix toolbars.
export default function EditMenuItems(): JSX.Element {
  const { edits, future, undo, redo } = useEditStore(
    useShallow((s) => ({ edits: s.edits, future: s.future, undo: s.undo, redo: s.redo })),
  );

  function handleExport() {
    const { edits: currentEdits } = useEditStore.getState();
    const payload = { version: 1, timestamp: new Date().toISOString(), edits: currentEdits };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "acacia-edits.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <DropdownMenuItem
        disabled={edits.length === 0}
        // Keep the menu open so repeated undo/redo doesn't require reopening.
        onSelect={(e) => {
          e.preventDefault();
          undo();
        }}
      >
        Undo
        <DropdownMenuShortcut>⌘Z</DropdownMenuShortcut>
      </DropdownMenuItem>
      <DropdownMenuItem
        disabled={future.length === 0}
        onSelect={(e) => {
          e.preventDefault();
          redo();
        }}
      >
        Redo
        <DropdownMenuShortcut>⇧⌘Z</DropdownMenuShortcut>
      </DropdownMenuItem>
      <DropdownMenuItem disabled={edits.length === 0} onSelect={handleExport}>
        Export edits as JSON…
      </DropdownMenuItem>
    </>
  );
}
