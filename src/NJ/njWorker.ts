import { nj } from "@holmrenser/nj";
import { NJMessage } from "./types";

self.onmessage = (event: MessageEvent<NJMessage>) => {
  postMessage("Worker received message: " + JSON.stringify(event.data));
  const {
    type,
    data: { njConfig },
  } = event.data;

  if (type === "runNJ") {
    try {
      const onProgress = (current: number, total: number) => {
        postMessage({ type: "njProgress", current, total });
      };
      const result = nj(njConfig, onProgress);
      postMessage({ type: "njResult", result });
    } catch (error) {
      postMessage({
        type: "njError",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
};
postMessage("loaded");
