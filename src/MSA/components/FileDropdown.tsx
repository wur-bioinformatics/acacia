import type { JSX } from "react";
import { useRef, useState } from "react";
import { useMSAStore } from "../stores/msaStore";
import { useEditStore } from "../../editStore";
import { useSequenceStore } from "../../sequenceStore";
import { applyEdits, resolveDisplayName } from "../../editUtils";
import { serializeFasta } from "../utils/fasta";
import { importFastaFile } from "../utils/importMSA";
import { downloadFile } from "../utils/download";
import type { MSAData } from "../types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// The current alignment as shown on screen: original import with row/column
// removals applied, rows in the current display order, and renames resolved.
// `applyEdits` keeps original identifiers (renames live in the edit log and are
// resolved separately for display), so we map renames in as a final step.
function currentOrderedMSA(): MSAData {
  const { originalMSA, edits } = useEditStore.getState();
  const base =
    originalMSA.length > 0 ? applyEdits(originalMSA, edits) : useMSAStore.getState().msaData;
  const { order } = useSequenceStore.getState();
  const ordered =
    order.length === 0
      ? base
      : (() => {
          const byId = new Map(base.map((s) => [s.identifier, s]));
          return order
            .map((id) => byId.get(id))
            .filter((s): s is MSAData[number] => s !== undefined);
        })();
  return ordered.map((s) => ({
    identifier: resolveDisplayName(s.identifier, edits),
    sequence: s.sequence,
  }));
}

export default function FileDropdown(): JSX.Element {
  const fileRef = useRef<HTMLInputElement>(null);
  const setMSAData = useMSAStore((s) => s.setMSAData);
  const [error, setError] = useState<string | null>(null);
  // Holds a parsed alignment awaiting confirmation when importing would discard
  // unsaved edits.
  const [pending, setPending] = useState<{ msa: MSAData; editCount: number } | null>(null);

  function commitImport(msa: MSAData) {
    setMSAData(msa);
    setPending(null);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset so re-selecting the same file fires onChange again.
    e.target.value = "";
    if (!file) return;
    setError(null);
    const result = await importFastaFile(file);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const editCount = useEditStore.getState().edits.length;
    if (editCount > 0) {
      setPending({ msa: result.msa, editCount });
    } else {
      commitImport(result.msa);
    }
  }

  function exportCurrent() {
    downloadFile(serializeFasta(currentOrderedMSA()), "alignment.fasta", "text/x-fasta");
  }

  function exportOriginal() {
    const { originalMSA } = useEditStore.getState();
    const msa = originalMSA.length > 0 ? originalMSA : useMSAStore.getState().msaData;
    downloadFile(serializeFasta(msa), "alignment-original.fasta", "text/x-fasta");
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".fasta,.fa,.fna,.faa,.txt"
        className="hidden"
        onChange={handleFile}
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">File</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-max p-1">
          <DropdownMenuItem onSelect={() => fileRef.current?.click()}>
            Import FASTA…
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Export FASTA
          </DropdownMenuLabel>
          <DropdownMenuItem onSelect={exportCurrent}>
            Current alignment
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={exportOriginal}>
            Original (unedited)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {error && (
        <Alert
          variant="destructive"
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-md shadow-lg py-1 px-3"
        >
          <AlertDescription className="text-xs flex items-center justify-between gap-2">
            <span>{error}</span>
            <Button variant="ghost" size="xs" onClick={() => setError(null)}>
              ✕
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Dialog open={pending !== null} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Replace alignment?</DialogTitle>
          </DialogHeader>
          {pending && (
            <>
              <p className="text-xs text-muted-foreground">
                Importing a new alignment discards the current one along with{" "}
                {pending.editCount} unsaved{" "}
                {pending.editCount === 1 ? "edit" : "edits"} (row/column removals,
                renames). This cannot be undone.
              </p>
              <DialogFooter>
                <Button variant="outline" size="sm" onClick={() => setPending(null)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => commitImport(pending.msa)}
                >
                  Replace
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
