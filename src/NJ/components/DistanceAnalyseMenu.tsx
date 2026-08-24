import type { JSX } from "react";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useNJStore } from "../stores/njStore";
import useAnalysis from "../useAnalysis";
import { modelLabel, rateHetLabel } from "../substitutionModels";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/**
 * Second step of the pipeline: infer a tree from the distances on screen. The
 * substitution model is fixed to the one the matrix was computed with — only
 * the bootstrap count is still open.
 */
export default function DistanceAnalyseMenu(): JSX.Element {
  const { buildTree } = useAnalysis();
  const distanceParams = useNJStore((s) => s.distanceParams);
  const njStatus = useNJStore((s) => s.status);
  const [open, setOpen] = useState(false);
  const [nBootstrapSamples, setNBootstrapSamples] = useState(100);

  const rateHet = distanceParams
    ? rateHetLabel(distanceParams.gamma_shape, distanceParams.p_invar)
    : "";

  function handleBuildTree() {
    if (!distanceParams) return;
    setOpen(false);
    buildTree({
      substitutionModel: distanceParams.substitution_model,
      gammaShape: distanceParams.gamma_shape,
      pInvar: distanceParams.p_invar,
      nBootstrapSamples,
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
              Distances
            </DropdownMenuLabel>
            <p className="px-2 text-xs max-w-56">
              {distanceParams ? (
                <>
                  {modelLabel(distanceParams.substitution_model)} substitution model
                  {rateHet ? ` · ${rateHet}` : ""}
                </>
              ) : (
                "No distances computed yet."
              )}
            </p>
            <p className="px-2 pt-1 text-xs text-muted-foreground max-w-56">
              The tree is inferred from these distances. To use a different
              model, recompute the distances from the MSA view.
            </p>
            <label className="flex items-center justify-between gap-6 px-2 py-1.5 pt-2 text-sm">
              Bootstrap replicates
              <Input
                type="number"
                size="xs"
                className="w-20 text-center"
                min={0}
                step={100}
                value={nBootstrapSamples}
                onChange={(e) => setNBootstrapSamples(Math.max(0, parseInt(e.target.value) || 0))}
              />
            </label>
            <div className="px-2 pt-1">
              <Button
                size="xs"
                className="w-full"
                onClick={handleBuildTree}
                disabled={njStatus === "running" || !distanceParams}
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
