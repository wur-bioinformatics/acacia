import type { JSX } from "react";
import { useShallow } from "zustand/react/shallow";
import { useEditStore } from "./editStore";
import { Button } from "@/components/ui/button";

export default function UndoRedoButtons(): JSX.Element | null {
  const { edits, future, undo, redo } = useEditStore(
    useShallow((s) => ({ edits: s.edits, future: s.future, undo: s.undo, redo: s.redo }))
  );

  if (edits.length === 0 && future.length === 0) return null;

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
    <div className="inline-flex isolate [&>button]:rounded-none [&>button:first-child]:rounded-l-md [&>button:last-child]:rounded-r-md [&>button:not(:first-child)]:-ml-px">
      <Button
        variant="outline"
        size="icon-xs"
        onClick={undo}
        disabled={edits.length === 0}
        title="Undo (Cmd+Z)"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 14 4 9 9 4" /><path d="M20 20v-7a4 4 0 0 0-4-4H4" />
        </svg>
      </Button>
      <Button
        variant="outline"
        size="icon-xs"
        onClick={redo}
        disabled={future.length === 0}
        title="Redo (Cmd+Shift+Z)"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 14 20 9 15 4" /><path d="M4 20v-7a4 4 0 0 1 4-4h12" />
        </svg>
      </Button>
      {edits.length > 0 && (
        <Button
          variant="outline"
          size="icon-xs"
          onClick={handleExport}
          title="Export edits as JSON"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </Button>
      )}
    </div>
  );
}
