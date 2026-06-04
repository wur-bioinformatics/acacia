import type { JSX } from "react";
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import type { NJConfig } from "@holmrenser/nj";

type SubstitutionModel = NJConfig["substitution_model"];
import { useMSAStore } from "../stores/msaStore";
import { useDrawStore } from "../stores/drawStore";
import { useNJStore } from "../../NJ/stores/njStore";
import { useNJWorker } from "../../NJ";
import { CancelledError } from "../../NJ/useNJWorker";
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
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

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
  { value: "TajimaNei", label: "Tajima-Nei", description: "DNA only", sequenceType: "DNA" },
  { value: "Tamura", label: "Tamura", description: "DNA only", sequenceType: "DNA" },
  { value: "Poisson", label: "Poisson", description: "protein only", sequenceType: "Protein" },
  { value: "KimuraProtein", label: "Kimura (protein)", description: "protein only", sequenceType: "Protein" },
];

export default function AnalyseDropdown(): JSX.Element {
  const { runNJ, cancel: cancelNJWorker } = useNJWorker();
  const { runTrident, runTcs, cancel: cancelQualityWorker } = useQualityWorker();
  const { msaData } = useMSAStore();
  const { sequenceTypeOverride } = useDrawStore();
  const { detectedSequenceType } = useMSAStore();
  const {
    status: njStatus,
    setRunning,
    setResult,
    setError,
    setProgress,
    setCancel,
    setCancelled,
  } = useNJStore();
  const {
    tridentStatus,
    tcsStatus,
    setTridentRunning,
    setTridentResult,
    setTridentError,
    setTridentCancel,
    setTridentCancelled,
    setTcsRunning,
    setTcsResult,
    setTcsError,
    setTcsProgress,
    setTcsCancel,
    setTcsCancelled,
  } = useQualityStore();
  const { setView } = useViewStore();

  const effectiveType = sequenceTypeOverride ?? detectedSequenceType;

  const [open, setOpen] = useState(false);
  const [substitutionModel, setSubstitutionModel] = useState<SubstitutionModel>("PDiff");
  const [nBootstrapSamples, setNBootstrapSamples] = useState(100);
  const [gammaEnabled, setGammaEnabled] = useState(false);
  const [gammaShape, setGammaShape] = useState(1.0);
  const [pInvarEnabled, setPInvarEnabled] = useState(false);
  const [pInvar, setPInvar] = useState(0.2);

  // Gamma / invariant-sites corrections have no effect on the raw p-distance model.
  const rateHetApplicable = substitutionModel !== "PDiff";

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
    setCancel(() => {
      cancelNJWorker();
      setCancelled();
    });
    setOpen(false);
    const njConfig: NJConfig = {
      msa: effectiveMSA(),
      n_bootstrap_samples: nBootstrapSamples,
      substitution_model: substitutionModel,
      alphabet: null,
      num_threads: null,
      return_distance_matrix: false,
      return_average_distance: false,
      gamma_shape: rateHetApplicable && gammaEnabled ? gammaShape : null,
      p_invar: rateHetApplicable && pInvarEnabled ? pInvar : null,
    };
    runNJ({
      njConfig,
      onProgress: (current, total) => setProgress(current, total),
    })
      .then(({ newick, distanceMatrix, avgDistance }) => {
        setResult(newick, distanceMatrix, avgDistance, {
          substitution_model: substitutionModel,
          n_bootstrap_samples: nBootstrapSamples,
          gamma_shape: njConfig.gamma_shape,
          p_invar: njConfig.p_invar,
        });
        setView("Tree");
      })
      .catch((err: Error) => {
        if (err instanceof CancelledError) return;
        setError(err.message);
      });
  }

  function handleRunTrident() {
    setTridentRunning();
    setTridentCancel(() => {
      cancelQualityWorker();
      setTridentCancelled();
    });
    setOpen(false);
    runTrident({ msaData: effectiveMSA(), sequenceType: effectiveType })
      .then((trident) => setTridentResult(trident))
      .catch((err: Error) => {
        if (err instanceof CancelledError) return;
        setTridentError(err.message);
      });
  }

  function handleRunTcs() {
    setTcsRunning();
    setTcsCancel(() => {
      cancelQualityWorker();
      setTcsCancelled();
    });
    setOpen(false);
    const msa = effectiveMSA();
    const identifiers = msa.map((s) => s.identifier);
    runTcs({
      msaData: msa,
      sequenceType: effectiveType,
      onProgress: (stage, current, total) => setTcsProgress(stage, current, total),
    })
      .then(({ tcs, tcsColMean }) => setTcsResult(tcs, tcsColMean, identifiers))
      .catch((err: Error) => {
        if (err instanceof CancelledError) return;
        setTcsError(err.message);
      });
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm">Analyse</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-max p-2">
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Build NJ tree</DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="min-w-max p-2">
            <DropdownMenuLabel className="text-xs text-muted-foreground">
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

            <DropdownMenuLabel className="text-xs text-muted-foreground pt-2">
              Rate heterogeneity
            </DropdownMenuLabel>
            <div className={`px-2 space-y-1.5 ${rateHetApplicable ? "" : "opacity-30"}`}>
              <label
                className={`flex items-center justify-between gap-4 text-sm ${rateHetApplicable ? "cursor-pointer" : "cursor-not-allowed"}`}
              >
                <span className="flex items-center gap-2 whitespace-nowrap">
                  <Switch
                    size="sm"
                    checked={rateHetApplicable && gammaEnabled}
                    onCheckedChange={setGammaEnabled}
                    disabled={!rateHetApplicable}
                  />
                  Gamma shape α
                </span>
                <Input
                  type="number"
                  size="xs"
                  className="w-20 text-center"
                  min={0.01}
                  step={0.1}
                  value={gammaShape}
                  disabled={!rateHetApplicable || !gammaEnabled}
                  onChange={(e) => setGammaShape(Math.max(0.01, parseFloat(e.target.value) || 0.01))}
                />
              </label>
              <label
                className={`flex items-center justify-between gap-4 text-sm ${rateHetApplicable ? "cursor-pointer" : "cursor-not-allowed"}`}
              >
                <span className="flex items-center gap-2 whitespace-nowrap">
                  <Switch
                    size="sm"
                    checked={rateHetApplicable && pInvarEnabled}
                    onCheckedChange={setPInvarEnabled}
                    disabled={!rateHetApplicable}
                  />
                  Invariant sites
                </span>
                <Input
                  type="number"
                  size="xs"
                  className="w-20 text-center"
                  min={0}
                  max={0.99}
                  step={0.05}
                  value={pInvar}
                  disabled={!rateHetApplicable || !pInvarEnabled}
                  onChange={(e) =>
                    setPInvar(Math.min(0.99, Math.max(0, parseFloat(e.target.value) || 0)))
                  }
                />
              </label>
            </div>

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
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>MSA quality</DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="min-w-[220px] p-2">
            <DropdownMenuLabel>TRIDENT</DropdownMenuLabel>
            <p className="px-2 text-xs text-muted-foreground max-w-56">
              Per-column conservation score. Fast.
            </p>
            <div className="px-2 pt-1">
              <Button
                size="xs"
                className="w-full"
                onClick={handleRunTrident}
                disabled={tridentStatus === "running"}
              >
                {tridentStatus === "running" ? (
                  <>
                    <Loader2 className="size-3 animate-spin" />
                    Computing…
                  </>
                ) : (
                  "Compute TRIDENT"
                )}
              </Button>
            </div>

            <DropdownMenuLabel className="pt-3">TCS</DropdownMenuLabel>
            <p className="px-2 text-xs text-muted-foreground max-w-56">
              Per-residue consistency score. Heavy for large alignments.
            </p>
            <div className="px-2 pt-1">
              <Button
                size="xs"
                className="w-full"
                onClick={handleRunTcs}
                disabled={tcsStatus === "running"}
              >
                {tcsStatus === "running" ? (
                  <>
                    <Loader2 className="size-3 animate-spin" />
                    Computing…
                  </>
                ) : (
                  "Compute TCS"
                )}
              </Button>
            </div>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
