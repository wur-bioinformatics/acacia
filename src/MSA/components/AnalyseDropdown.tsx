import type { JSX } from "react";
import { useState, useEffect } from "react";
import type { NJConfig } from "@holmrenser/nj";

type SubstitutionModel = NJConfig["substitution_model"];
import { useMSAStore } from "../stores/msaStore";
import { useDrawStore } from "../stores/drawStore";
import { useNJStore } from "../../NJ/njStore";
import { useNJWorker } from "../../NJ";
import { useViewStore } from "../../viewStore";
import type { SequenceType } from "../types";
import { useEditStore } from "../../editStore";
import { applyEdits } from "../../editUtils";

type SubstitutionModelOption = {
  value: string;
  label: string;
  description: string;
  sequenceType: SequenceType | null;
};

const SUBSTITUTION_MODELS: SubstitutionModelOption[] = [
  { value: "PDiff", label: "PDiff", description: "p-distance", sequenceType: null },
  { value: "JukesCantor", label: "Jukes-Cantor", description: "DNA only", sequenceType: "DNA" },
  { value: "Kimura2P", label: "Kimura 2P", description: "DNA only", sequenceType: "DNA" },
  { value: "Poisson", label: "Poisson", description: "protein only", sequenceType: "Protein" },
];

export default function AnalyseDropdown({ id }: { id: string }): JSX.Element {
  const { runNJ } = useNJWorker();
  const { msaData } = useMSAStore();
  const { sequenceTypeOverride } = useDrawStore();
  const { detectedSequenceType } = useMSAStore();
  const {
    status: njStatus,
    setRunning,
    setResult,
    setError,
    setProgress,
  } = useNJStore();
  const { setView } = useViewStore();

  const effectiveType = sequenceTypeOverride ?? detectedSequenceType;

  const [substitutionModel, setSubstitutionModel] = useState<SubstitutionModel>("PDiff");
  const [nBootstrapSamples, setNBootstrapSamples] = useState(100);

  useEffect(() => {
    const model = SUBSTITUTION_MODELS.find((m) => m.value === substitutionModel);
    if (model?.sequenceType !== null && model?.sequenceType !== effectiveType) {
      setSubstitutionModel("PDiff");
    }
  }, [effectiveType, substitutionModel]);

  function handleRunNJ() {
    setRunning();
    document.getElementById(id)?.hidePopover();
    const { originalMSA, edits } = useEditStore.getState();
    const effectiveMSA = originalMSA.length > 0 ? applyEdits(originalMSA, edits) : msaData;
    const njConfig: NJConfig = {
      msa: effectiveMSA,
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
        setResult(newick, distanceMatrix, avgDistance, {
          substitution_model: substitutionModel,
          n_bootstrap_samples: nBootstrapSamples,
        });
        setView("Tree");
      })
      .catch((err: Error) => setError(err.message));
  }

  return (
    <ul
      id={id}
      popover="auto"
      className="dropdown menu menu-sm bg-base-100 rounded-box shadow-lg min-w-max p-2"
      style={{ positionAnchor: `--${id}` }}
    >
      <li>
        <a className="menu-title">Build NJ tree</a>
      </li>
      <li>
        <a className="menu-title">Substitution model</a>
        <ul>
          {SUBSTITUTION_MODELS.map(({ value, label, description, sequenceType }) => {
            const disabled = sequenceType !== null && sequenceType !== effectiveType;
            return (
              <li key={value} className={disabled ? "opacity-30" : ""}>
                <label className={`flex items-center gap-2 whitespace-nowrap ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}>
                  <input
                    type="radio"
                    className="radio radio-xs"
                    name="substitutionModel"
                    checked={substitutionModel === value}
                    disabled={disabled}
                    onChange={() => setSubstitutionModel(value as SubstitutionModel)}
                  />
                  <span>{label}</span>
                  <span className="opacity-40 text-xs">{description}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </li>
      <li>
        <label className="flex items-center justify-between gap-6 cursor-pointer">
          Bootstrap replicates
          <input
            type="number"
            className="input input-xs w-20 text-center"
            min={0}
            step={100}
            value={nBootstrapSamples}
            onChange={(e) =>
              setNBootstrapSamples(Math.max(0, parseInt(e.target.value) || 0))
            }
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
