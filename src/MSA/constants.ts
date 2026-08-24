import type { TrackType } from "./types";

export const CELL_SIZE = 16;
export const LABEL_WIDTH = 150;
export const MINIMAP_HEIGHT = 50;
export const MINIMAP_EDGE_ZONE = 8;
export const CELL_FILL_RATIO = 0.95;
export const SCALEBAR_HEIGHT = 22;

/** The blue used for the cursor cross-hair on the MSA overlay. Shared by the
 * scalebar marker, the status-bar position badge and the cursor tooltip so all
 * cursor affordances read as one colour. */
export const CURSOR_RGB = "48,92,222";
/** Lightened variant — the base blue is too dark to read on a dark background. */
export const CURSOR_RGB_DARK = "125,163,255";

export const TRACK_LABELS: Record<TrackType, string> = {
  conservation: "Conservation",
  logo: "Logo",
  trident: "TRIDENT",
  tcs: "TCS",
};
