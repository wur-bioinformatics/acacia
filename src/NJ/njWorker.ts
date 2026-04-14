import { nj, type NJEvent } from "@holmrenser/nj";
import { NJMessage } from "./types";

self.onmessage = (event: MessageEvent<NJMessage>) => {
  postMessage("Worker received message: " + JSON.stringify(event.data));
  const {
    type,
    data: { njConfig },
  } = event.data;

  if (type === "runNJ") {
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
      postMessage({
        type: "njError",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
};
postMessage("loaded");
