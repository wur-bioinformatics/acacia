import type { JSX } from "react";
import { useState } from "react";
import type { NJConfig, DistanceResult } from "@holmrenser/nj";
import { useMSAStore } from "../stores/msaStore";
import { useNJStore } from "../../NJ/njStore";
import type { NJOptions } from "../../NJ";
import { useViewStore } from "../../viewStore";

type SubstitutionModelOption = {
  value: string;
  label: string;
  description: string;
};

const SUBSTITUTION_MODELS: SubstitutionModelOption[] = [
  { value: "PDiff", label: "PDiff", description: "p-distance (DNA + protein)" },
  { value: "JukesCantor", label: "Jukes-Cantor", description: "DNA only" },
  { value: "Kimura2P", label: "Kimura 2P", description: "DNA only" },
  { value: "Poisson", label: "Poisson", description: "protein only" },
];

type RunNJ = (options: NJOptions) => Promise<{ newick: string; distanceMatrix: DistanceResult; avgDistance: number }>;

export default function AnalyseDropdown({ onClose, runNJ }: { onClose: () => void; runNJ: RunNJ }): JSX.Element {
  const { msaData } = useMSAStore();
  const { status: njStatus, setRunning, setResult, setError, setProgress } = useNJStore();
  const { setView } = useViewStore();

  const [substitutionModel, setSubstitutionModel] = useState("PDiff");
  const [nBootstrapSamples, setNBootstrapSamples] = useState(100);

  function handleRunNJ() {
    setRunning();
    onClose();
    const njConfig: NJConfig = {
      msa: msaData,
      n_bootstrap_samples: nBootstrapSamples,
      substitution_model: substitutionModel,
      alphabet: null,
      num_threads: null,
      return_distance_matrix: false,
      return_average_distance: false,
    };
    runNJ({
      njConfig,
      onProgress: (current, total) => setProgress(current, total),
    })
      .then(({ newick, distanceMatrix, avgDistance }) => {
        setResult(newick, distanceMatrix, avgDistance, { substitution_model: substitutionModel, n_bootstrap_samples: nBootstrapSamples });
        setView("Tree");
      })
      .catch((err: Error) => setError(err.message));
  }

  return (
    <ul className="absolute top-full left-0 mt-1 menu menu-sm bg-base-100 rounded-box shadow-lg z-20 min-w-max p-2">
      <li><a className="menu-title">Build NJ tree</a></li>
      <li>
        <a className="menu-title">Substitution model</a>
        <ul>
          {SUBSTITUTION_MODELS.map(({ value, label, description }) => (
            <li key={value}>
              <label className="flex items-center gap-2 cursor-pointer whitespace-nowrap">
                <input
                  type="radio"
                  className="radio radio-xs"
                  name="substitutionModel"
                  checked={substitutionModel === value}
                  onChange={() => setSubstitutionModel(value)}
                />
                <span>{label}</span>
                <span className="opacity-40 text-xs">{description}</span>
              </label>
            </li>
          ))}
        </ul>
      </li>
      <li>
        <label className="flex items-center justify-between gap-6 cursor-pointer">
          Bootstrap replicates
          <input
            type="number"
            className="input input-xs w-20 text-right"
            min={0}
            step={100}
            value={nBootstrapSamples}
            onChange={(e) => setNBootstrapSamples(Math.max(0, parseInt(e.target.value) || 0))}
          />
        </label>
      </li>
      <li className="mt-1">
        <button
          className="btn btn-xs btn-primary w-full"
          onClick={handleRunNJ}
          disabled={njStatus === "running"}
        >
          {njStatus === "running" ? (
            <>
              <span className="loading loading-spinner loading-xs" />
              Running…
            </>
          ) : (
            "Run"
          )}
        </button>
      </li>
    </ul>
  );
}
