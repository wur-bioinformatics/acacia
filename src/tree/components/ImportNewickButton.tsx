import { useRef, useState, type JSX } from "react";
import { flattenTree, parseNewick } from "../layout";
import { useTreeStore } from "../treeStore";
import { useSequenceStore } from "../../sequenceStore";
import type { FlatTree } from "../types";

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

export default function ImportNewickButton(): JSX.Element {
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
    e.target.value = ""; // reset so same file can be re-imported
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

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".nwk,.newick,.tre,.tree,.txt"
        className="hidden"
        onChange={handleFile}
      />
      <button onClick={() => fileRef.current?.click()}>Import tree</button>

      {parseError && (
        <div
          role="alert"
          className="alert alert-error text-xs py-1 px-3 fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-md shadow-lg"
        >
          <span>{parseError}</span>
          <button className="btn btn-xs btn-ghost" onClick={() => setParseError(null)}>
            ✕
          </button>
        </div>
      )}

      {modal && (
        <dialog open className="modal modal-open">
          <div className="modal-box max-w-md">
            <h3 className="font-bold text-sm mb-2">Import tree — name mismatches</h3>
            <p className="text-xs text-base-content/70 mb-3">
              {modal.onlyInTree.length} tree{" "}
              {modal.onlyInTree.length === 1 ? "leaf" : "leaves"} not found in
              the alignment. These will be missing from the linked view.
            </p>
            <div className="bg-base-200 rounded p-2 text-xs font-mono max-h-40 overflow-y-auto mb-3">
              {modal.onlyInTree.map((n) => (
                <div key={n} className="text-warning">{n}</div>
              ))}
            </div>
            {modal.onlyInMSA.length > 0 && (
              <p className="text-xs text-base-content/70 mb-3">
                {modal.onlyInMSA.length} alignment{" "}
                {modal.onlyInMSA.length === 1 ? "sequence" : "sequences"} not
                in tree — {modal.onlyInMSA.length === 1 ? "it" : "they"} will
                be appended after tree leaves.
              </p>
            )}
            <div className="modal-action gap-2">
              <button className="btn btn-sm" onClick={() => setModal(null)}>
                Cancel
              </button>
              <button
                className="btn btn-sm btn-primary"
                onClick={() => commitImport(modal.ft, modal.leafNames)}
              >
                Import anyway
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button onClick={() => setModal(null)}>close</button>
          </form>
        </dialog>
      )}
    </>
  );
}
