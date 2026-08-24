import { nj, distance_matrix, average_distance, type NJEvent } from "@holmrenser/nj";
import { NJMessage } from "../types";

/**
 * nj.rs sets a stable `Error.name` code (e.g. "IncompatibleModel",
 * "SequenceLengthMismatch"); forward it so the UI can branch on the code
 * rather than matching the raw message text.
 */
function postError(error: unknown) {
  postMessage({
    type: "njError",
    error: error instanceof Error ? error.message : String(error),
    code: error instanceof Error ? error.name : undefined,
  });
}

self.onmessage = (event: MessageEvent<NJMessage>) => {
  const message = event.data;

  if (message.type === "runNJ") {
    const { njConfig } = message.data;
    try {
      const onEvent = (njEvent: NJEvent) => {
        if (njEvent.type === "BootstrapProgress") {
          postMessage({ type: "njProgress", current: njEvent.completed, total: njEvent.total });
        }
      };
      const { newick, distance_matrix: distanceMatrix, average_distance: avgDistance } = nj(
        { ...njConfig, return_distance_matrix: true, return_average_distance: true },
        onEvent,
      );
      postMessage({ type: "njResult", newick, distanceMatrix, avgDistance });
    } catch (error) {
      postError(error);
    }
  }

  if (message.type === "runDistances") {
    const { distConfig } = message.data;
    try {
      const distanceMatrix = distance_matrix(distConfig);
      const avgDistance = average_distance(distConfig);
      postMessage({ type: "distanceResult", distanceMatrix, avgDistance });
    } catch (error) {
      postError(error);
    }
  }
};
