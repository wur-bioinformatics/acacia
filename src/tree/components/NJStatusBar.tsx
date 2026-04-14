import type { JSX } from "react";
import { useNJStore } from "../../NJ/njStore";
import type { NJParams } from "../../NJ/njStore";

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

export default function NJStatusBar(): JSX.Element | null {
  const { njParams } = useNJStore();
  if (!njParams) return null;
  return (
    <div className="flex items-center gap-4 border-t border-base-200 mt-2 pt-1 text-xs font-mono opacity-35 px-1">
      <span>{njParamLabel(njParams)}</span>
    </div>
  );
}
