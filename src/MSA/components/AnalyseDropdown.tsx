import type { JSX } from "react";
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import type { NJConfig } from "@holmrenser/nj";

type SubstitutionModel = NJConfig["substitution_model"];
import { useMSAStore } from "../stores/msaStore";
import { useDrawStore } from "../stores/drawStore";
import { useNJStore } from "../../NJ/stores/njStore";
import { useNJWorker } from "../../NJ";
import { useViewStore } from "../../viewStore";
import type { SequenceType } from "../types";
import { useEditStore } from "../../editStore";
import { applyEdits } from "../../editUtils";
import { useQualityStore } from "../stores/qualityStore";
import useQualityWorker from "../hooks/useQualityWorker";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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

export default function AnalyseDropdown(): JSX.Element {
  const { runNJ } = useNJWorker();
  const { runQuality } = useQualityWorker();
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
  const {
    status: qualityStatus,
    setRunning: setQualityRunning,
    setResult: setQualityResult,
    setError: setQualityError,
    setProgress: setQualityProgress,
  } = useQualityStore();
  const { setView } = useViewStore();

  const effectiveType = sequenceTypeOverride ?? detectedSequenceType;

  const [open, setOpen] = useState(false);
  const [substitutionModel, setSubstitutionModel] = useState<SubstitutionModel>("PDiff");
  const [nBootstrapSamples, setNBootstrapSamples] = useState(100);

  useEffect(() => {
    const model = SUBSTITUTION_MODELS.find((m) => m.value === substitutionModel);
    if (model?.sequenceType !== null && model?.sequenceType !== effectiveType) {
      setSubstitutionModel("PDiff");
    }
  }, [effectiveType, substitutionModel]);

  function effectiveMSA() {
    const { originalMSA, edits } = useEditStore.getState();
    return originalMSA.length > 0 ? applyEdits(originalMSA, edits) : msaData;
  }

  function handleRunNJ() {
    setRunning();
    setOpen(false);
    const njConfig: NJConfig = {
      msa: effectiveMSA(),
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

  function handleRunQuality() {
    setQualityRunning();
    setOpen(false);
    const msa = effectiveMSA();
    const identifiers = msa.map((s) => s.identifier);
    runQuality({
      msaData: msa,
      sequenceType: effectiveType,
      onProgress: (stage, current, total) => setQualityProgress(stage, current, total),
    })
      .then(({ trident, tcs, tcsColMean }) =>
        setQualityResult(trident, tcs, tcsColMean, identifiers),
      )
      .catch((err: Error) => setQualityError(err.message));
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm">Analyse</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-max p-2">
        <DropdownMenuLabel>Build NJ tree</DropdownMenuLabel>
        <DropdownMenuLabel className="text-xs text-muted-foreground pt-2">
          Substitution model
        </DropdownMenuLabel>
        <RadioGroup
          value={substitutionModel}
          onValueChange={(v) => setSubstitutionModel(v as SubstitutionModel)}
          className="gap-1 px-2"
        >
          {SUBSTITUTION_MODELS.map(({ value, label, description, sequenceType }) => {
            const disabled = sequenceType !== null && sequenceType !== effectiveType;
            return (
              <label
                key={value}
                className={`flex items-center gap-2 whitespace-nowrap text-sm ${disabled ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}`}
              >
                <RadioGroupItem value={value} disabled={disabled} className="size-3" />
                <span>{label}</span>
                <span className="opacity-40 text-xs">{description}</span>
              </label>
            );
          })}
        </RadioGroup>
        <label className="flex items-center justify-between gap-6 px-2 py-1.5 text-sm">
          Bootstrap replicates
          <Input
            type="number"
            size="xs"
            className="w-20 text-center"
            min={0}
            step={100}
            value={nBootstrapSamples}
            onChange={(e) =>
              setNBootstrapSamples(Math.max(0, parseInt(e.target.value) || 0))
            }
          />
        </label>
        <div className="px-2 pt-1">
          <Button
            size="xs"
            className="w-full"
            onClick={handleRunNJ}
            disabled={njStatus === "running"}
          >
            {njStatus === "running" ? (
              <>
                <Loader2 className="size-3 animate-spin" />
                Running…
              </>
            ) : (
              "Run"
            )}
          </Button>
        </div>

        <DropdownMenuLabel className="pt-3">MSA quality</DropdownMenuLabel>
        <p className="px-2 text-xs text-muted-foreground max-w-56">
          TRIDENT + TCS per-column scores. Heavy for large alignments.
        </p>
        <div className="px-2 pt-1">
          <Button
            size="xs"
            className="w-full"
            onClick={handleRunQuality}
            disabled={qualityStatus === "running"}
          >
            {qualityStatus === "running" ? (
              <>
                <Loader2 className="size-3 animate-spin" />
                Computing…
              </>
            ) : (
              "Compute"
            )}
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
