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
  const { metric, msaData, sequenceType } = event.data;

  try {
    const { matrix, gapOpen, gapExtend, alphabetSize } = SCORING_PARAMS[sequenceType];

    if (metric === "trident") {
      const trident = computeTrident(msaData, matrix, alphabetSize);
      postMessage({ type: "tridentResult", trident });
      return;
    }

    const lookup = buildLookup(matrix);
    const post = (stage: QualityStage, current: number, total: number) =>
      postMessage({ type: "qualityProgress", metric, stage, current, total });

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

    postMessage({ type: "tcsResult", tcs, tcsColMean });
  } catch (error) {
    postMessage({
      type: "qualityError",
      metric,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
