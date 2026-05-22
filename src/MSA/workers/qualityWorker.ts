import type { QualityRunMessage, QualityStage } from "../types";
import {
  SCORING_PARAMS,
  buildLookup,
  buildPairwiseLibrary,
  computeTcsColumnMeans,
  computeTcsFromLibrary,
  computeTrident,
  stripGapsAndIndex,
} from "../utils/quality";

self.onmessage = (event: MessageEvent<QualityRunMessage>) => {
  if (event.data.type !== "runQuality") return;
  const { msaData, sequenceType } = event.data;

  try {
    const { matrix, gapOpen, gapExtend, alphabetSize } = SCORING_PARAMS[sequenceType];
    const lookup = buildLookup(matrix);

    const post = (stage: QualityStage, current: number, total: number) =>
      postMessage({ type: "qualityProgress", stage, current, total });

    const stripped = msaData.map((s) => stripGapsAndIndex(s.sequence));
    const library = buildPairwiseLibrary(
      stripped.map((s) => s.ungapped),
      lookup,
      gapOpen,
      gapExtend,
      (current, total) => post("library", current, total),
    );
    const tcs = computeTcsFromLibrary(
      msaData,
      stripped.map((s) => s.idx),
      library,
      (current, total) => post("scoring", current, total),
    );
    const tcsColMean = computeTcsColumnMeans(msaData, tcs);
    const trident = computeTrident(msaData, matrix, alphabetSize);

    postMessage({ type: "qualityResult", trident, tcs, tcsColMean });
  } catch (error) {
    postMessage({
      type: "qualityError",
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
