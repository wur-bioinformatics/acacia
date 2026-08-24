import { useCallback } from "react";
import type { DistConfig, NJConfig } from "@holmrenser/nj";
import useNJWorker, { CancelledError } from "./useNJWorker";
import { useNJStore } from "./stores/njStore";
import { useEditStore } from "../editStore";
import { applyEdits } from "../editUtils";
import { useViewStore } from "../viewStore";
import type { DistanceSettings, TreeSettings } from "./modelSettings";

/**
 * Runs the two steps of the analysis pipeline against the *edited* alignment,
 * writing results into `njStore` and navigating to the view that shows them.
 * Shared by the MSA toolbar (MSA → distances, MSA → tree) and the Distances
 * toolbar (distances → tree).
 */
export default function useAnalysis() {
  const { runNJ, runDistances, cancel: cancelWorker } = useNJWorker();

  const computeDistances = useCallback(
    ({ substitutionModel, gammaShape, pInvar }: DistanceSettings) => {
      const {
        setDistanceRunning,
        setDistanceResult,
        setDistanceError,
        setDistanceCancel,
        setDistanceCancelled,
      } = useNJStore.getState();
      setDistanceRunning();
      setDistanceCancel(() => {
        cancelWorker();
        setDistanceCancelled();
      });
      const distConfig: DistConfig = {
        msa: effectiveMSA(),
        substitution_model: substitutionModel,
        alphabet: null,
        num_threads: null,
        gamma_shape: gammaShape,
        p_invar: pInvar,
      };
      runDistances({ distConfig })
        .then(({ distanceMatrix, avgDistance }) => {
          setDistanceResult(distanceMatrix, avgDistance, {
            substitution_model: substitutionModel,
            gamma_shape: gammaShape,
            p_invar: pInvar,
          });
          useViewStore.getState().setView("Distances");
        })
        .catch((err: Error) => {
          if (err instanceof CancelledError) return;
          setDistanceError(err.message);
        });
    },
    [runDistances, cancelWorker],
  );

  const buildTree = useCallback(
    ({ substitutionModel, gammaShape, pInvar, nBootstrapSamples }: TreeSettings) => {
      const { setRunning, setResult, setError, setProgress, setCancel, setCancelled } =
        useNJStore.getState();
      setRunning();
      setCancel(() => {
        cancelWorker();
        setCancelled();
      });
      const njConfig: NJConfig = {
        msa: effectiveMSA(),
        n_bootstrap_samples: nBootstrapSamples,
        substitution_model: substitutionModel,
        alphabet: null,
        num_threads: null,
        return_distance_matrix: false,
        return_average_distance: false,
        gamma_shape: gammaShape,
        p_invar: pInvar,
      };
      runNJ({ njConfig, onProgress: (current, total) => setProgress(current, total) })
        .then(({ newick, distanceMatrix, avgDistance }) => {
          setResult(newick, distanceMatrix, avgDistance, {
            substitution_model: substitutionModel,
            n_bootstrap_samples: nBootstrapSamples,
            gamma_shape: gammaShape,
            p_invar: pInvar,
          });
          useViewStore.getState().setView("Tree");
        })
        .catch((err: Error) => {
          if (err instanceof CancelledError) return;
          setError(err.message);
        });
    },
    [runNJ, cancelWorker],
  );

  return { computeDistances, buildTree };
}

/** The alignment as currently displayed: original input with the edit log replayed. */
function effectiveMSA() {
  const { originalMSA, edits } = useEditStore.getState();
  return applyEdits(originalMSA, edits);
}
