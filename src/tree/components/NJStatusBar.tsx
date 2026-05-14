import type { JSX } from "react";
import { useNJStore } from "../../NJ/njStore";
import type { NJParams } from "../../NJ/njStore";
import { useTreeStore } from "../treeStore";

function njParamLabel(params: NJParams): string {
  const model =
    params.substitution_model === "Kimura2P"
      ? "Kimura 2P"
      : params.substitution_model === "JukesCantor"
        ? "Jukes-Cantor"
        : params.substitution_model;
  const bootstrap =
    params.n_bootstrap_samples === 0
      ? "no bootstraps"
      : `${params.n_bootstrap_samples} bootstrap replicates`;
  return `NJ tree built with nj.rs · ${model} subsitution model · ${bootstrap}`;
}

function treeStatsLabel(): string | null {
  const flatTree = useTreeStore.getState().flatTree;
  if (!flatTree) return null;
  let internal = 0;
  let totalLength = 0;
  for (const node of flatTree.nodes.values()) {
    if (node.childIds.length > 0) internal++;
    totalLength += node.length;
  }
  const leaves = flatTree.leafOrder.length;
  return `${leaves} leaves · ${internal} internal · total length ${totalLength.toFixed(3)}`;
}

export default function NJStatusBar(): JSX.Element | null {
  const njParams = useNJStore((s) => s.njParams);
  // Subscribe to flatTree so stats refresh on tree changes (reroot, ladderize, etc.).
  const flatTree = useTreeStore((s) => s.flatTree);
  const stats = flatTree ? treeStatsLabel() : null;
  if (!njParams && !stats) return null;
  return (
    <div className="flex items-center gap-4 border-t border-muted mt-2 pt-1 text-xs font-mono opacity-35 px-1">
      {njParams && <span>{njParamLabel(njParams)}</span>}
      {stats && <span className="ml-auto">{stats}</span>}
    </div>
  );
}
