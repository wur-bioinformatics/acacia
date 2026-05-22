import type { TrackType } from "./types";

export const CELL_SIZE = 16;
export const LABEL_WIDTH = 150;
export const MINIMAP_HEIGHT = 50;
export const MINIMAP_EDGE_ZONE = 8;
export const CELL_FILL_RATIO = 0.95;

export const TRACK_LABELS: Record<TrackType, string> = {
  conservation: "Conservation",
  logo: "Logo",
  trident: "TRIDENT",
  tcs: "TCS",
};
