import { useRef, useState, type JSX } from "react";
import { flattenTree, parseNewick } from "../layout";
import { useTreeStore } from "../treeStore";
import { useSequenceStore } from "../../sequenceStore";
import type { FlatTree } from "../types";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ValidationResult =
  | { ok: true; ft: FlatTree; leafNames: string[]; onlyInTree: string[]; onlyInMSA: string[] }
  | { ok: false; error: string };

function validate(text: string, msaOrder: readonly string[]): ValidationResult {
  let ft: FlatTree;
  try {
    ft = flattenTree(parseNewick(text));
  } catch {
    return { ok: false, error: "Could not parse Newick — check the file format." };
  }

  const leafNames = ft.leafOrder.map((id) => ft.nodes.get(id)!.name);
  const msaSet = new Set(msaOrder);
  const treeSet = new Set(leafNames);
  const onlyInTree = leafNames.filter((n) => !msaSet.has(n));
  const onlyInMSA = [...msaOrder].filter((n) => !treeSet.has(n));

  if (leafNames.every((n) => !msaSet.has(n))) {
    return {
      ok: false,
      error: `No tree leaf names match any sequence in the alignment. Check that names are consistent (e.g. no extra spaces or truncation).`,
    };
  }

  return { ok: true, ft, leafNames, onlyInTree, onlyInMSA };
}

export function useNewickImport(): { openPicker: () => void; elements: JSX.Element } {
  const fileRef = useRef<HTMLInputElement>(null);
  const [modal, setModal] = useState<{
    ft: FlatTree;
    leafNames: string[];
    onlyInTree: string[];
    onlyInMSA: string[];
  } | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const setFlatTree = useTreeStore((s) => s.setFlatTree);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result;
      if (typeof text !== "string") return;
      const msaOrder = useSequenceStore.getState().order;
      const result = validate(text, msaOrder);
      if (!result.ok) {
        setParseError(result.error);
        return;
      }
      setParseError(null);
      if (result.onlyInTree.length > 0) {
        setModal(result);
      } else {
        commitImport(result.ft, result.leafNames);
      }
    };
    reader.readAsText(file);
  }

  function commitImport(ft: FlatTree, leafNames: string[]) {
    setFlatTree(ft);
    useSequenceStore.getState().syncFromTreeLeafOrder(leafNames);
    setModal(null);
  }

  const elements = (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".nwk,.newick,.tre,.tree,.txt"
        className="hidden"
        onChange={handleFile}
      />

      {parseError && (
        <Alert
          variant="destructive"
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-md shadow-lg py-1 px-3"
        >
          <AlertDescription className="text-xs flex items-center justify-between gap-2">
            <span>{parseError}</span>
            <Button variant="ghost" size="xs" onClick={() => setParseError(null)}>
              ✕
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Dialog open={modal !== null} onOpenChange={(o) => !o && setModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Import tree — name mismatches</DialogTitle>
          </DialogHeader>
          {modal && (
            <>
              <p className="text-xs text-muted-foreground">
                {modal.onlyInTree.length} tree{" "}
                {modal.onlyInTree.length === 1 ? "leaf" : "leaves"} not found in
                the alignment. These will be missing from the linked view.
              </p>
              <div className="bg-muted rounded p-2 text-xs font-mono max-h-40 overflow-y-auto">
                {modal.onlyInTree.map((n) => (
                  <div key={n} className="text-yellow-700 dark:text-yellow-400">{n}</div>
                ))}
              </div>
              {modal.onlyInMSA.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {modal.onlyInMSA.length} alignment{" "}
                  {modal.onlyInMSA.length === 1 ? "sequence" : "sequences"} not
                  in tree — {modal.onlyInMSA.length === 1 ? "it" : "they"} will
                  be appended after tree leaves.
                </p>
              )}
              <DialogFooter>
                <Button variant="outline" size="sm" onClick={() => setModal(null)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => commitImport(modal.ft, modal.leafNames)}
                >
                  Import anyway
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );

  return {
    openPicker: () => fileRef.current?.click(),
    elements,
  };
}
