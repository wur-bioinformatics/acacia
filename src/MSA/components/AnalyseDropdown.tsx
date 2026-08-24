import type { JSX } from "react";
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useMSAStore } from "../stores/msaStore";
import { useDrawStore } from "../stores/drawStore";
import { useNJStore } from "../../NJ/stores/njStore";
import useAnalysis from "../../NJ/useAnalysis";
import { CancelledError } from "../../NJ/useNJWorker";
import { useEditStore } from "../../editStore";
import { applyEdits } from "../../editUtils";
import { useQualityStore } from "../stores/qualityStore";
import useQualityWorker from "../hooks/useQualityWorker";
import SubstitutionModelSettings from "./SubstitutionModelSettings";
import { isModelCompatible } from "../../NJ/substitutionModels";
import {
  DEFAULT_MODEL_SETTINGS,
  toDistanceSettings,
  type ModelSettings,
} from "../../NJ/modelSettings";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function AnalyseDropdown(): JSX.Element {
  const { computeDistances, buildTree } = useAnalysis();
  const { runTrident, runTcs, cancel: cancelQualityWorker } = useQualityWorker();
  const { msaData } = useMSAStore();
  const { sequenceTypeOverride } = useDrawStore();
  const { detectedSequenceType } = useMSAStore();
  const njStatus = useNJStore((s) => s.status);
  const distanceStatus = useNJStore((s) => s.distanceStatus);
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

  const effectiveType = sequenceTypeOverride ?? detectedSequenceType;

  const [open, setOpen] = useState(false);
  const [modelSettings, setModelSettings] = useState<ModelSettings>(DEFAULT_MODEL_SETTINGS);
  const [nBootstrapSamples, setNBootstrapSamples] = useState(100);

  function patchModelSettings(patch: Partial<ModelSettings>) {
    setModelSettings((s) => ({ ...s, ...patch }));
  }

  useEffect(() => {
    if (!isModelCompatible(modelSettings.substitutionModel, effectiveType)) {
      setModelSettings((s) => ({ ...s, substitutionModel: "PDiff" }));
    }
  }, [effectiveType, modelSettings.substitutionModel]);

  function effectiveMSA() {
    const { originalMSA, edits } = useEditStore.getState();
    return originalMSA.length > 0 ? applyEdits(originalMSA, edits) : msaData;
  }

  function handleComputeDistances() {
    setOpen(false);
    computeDistances(toDistanceSettings(modelSettings));
  }

  function handleBuildTree() {
    setOpen(false);
    buildTree({ ...toDistanceSettings(modelSettings), nBootstrapSamples });
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
          <DropdownMenuSubTrigger>Compute distances</DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="min-w-max p-2">
            <SubstitutionModelSettings
              settings={modelSettings}
              onChange={patchModelSettings}
              sequenceType={effectiveType}
            />
            <p className="px-2 pt-2 text-xs text-muted-foreground max-w-56">
              Computes the pairwise distance matrix only — no tree. Build a tree
              from it later in the Distances view.
            </p>
            <div className="px-2 pt-1">
              <Button
                size="xs"
                className="w-full"
                onClick={handleComputeDistances}
                disabled={distanceStatus === "running"}
              >
                {distanceStatus === "running" ? (
                  <>
                    <Loader2 className="size-3 animate-spin" />
                    Computing…
                  </>
                ) : (
                  "Compute distances"
                )}
              </Button>
            </div>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Build NJ tree</DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="min-w-max p-2">
            <SubstitutionModelSettings
              settings={modelSettings}
              onChange={patchModelSettings}
              sequenceType={effectiveType}
            />
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
            <p className="px-2 text-xs text-muted-foreground max-w-56">
              Computes distances and infers the tree in one go.
            </p>
            <div className="px-2 pt-1">
              <Button
                size="xs"
                className="w-full"
                onClick={handleBuildTree}
                disabled={njStatus === "running"}
              >
                {njStatus === "running" ? (
                  <>
                    <Loader2 className="size-3 animate-spin" />
                    Running…
                  </>
                ) : (
                  "Build tree"
                )}
              </Button>
            </div>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

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
