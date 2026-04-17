export type SequenceType = "DNA" | "Protein";
export type ScrollMode = "zoom" | "pan";
export type TrackType = "conservation" | "logo";

export const COLORSTYLES = [
  "DNA",
  "DNA ClustalX",
  "AA ClustalX",
  "AA Zappo",
  "AA Taylor",
  "Parsimony Informative",
  "Conserved",
  "Variable",
] as const;
export type ColorStyle = (typeof COLORSTYLES)[number];

export type DrawOptions = {
  cellSize: number;
  showLetters: boolean;
  showConsensus: boolean;
  showLabels: boolean;
  showMinimap: boolean;
  scale: number;
  isMinimap: boolean;
  offsetX: number;
  offsetY: number;
  colorStyle: ColorStyle;
  highlightPattern: string;
  highlightUseRegex: boolean;
  darkMode: boolean;
};

export type SeqObject = {
  identifier: string;
  sequence: string;
};

export type MSAData = SeqObject[];

export type MSAColumnAnalysis = {
  parsimonyInformativeSites: number[];
  conservedSites: number[];
  variableSites: number[];
};

export type MSAColumnStat = {
  dominantChar: string;
  /** Fraction of non-gap positions that match the dominant character (0–1). */
  score: number;
  counts: Record<string, number>;
};

export type InitMessage = { type: "init"; canvas: OffscreenCanvas };
export type SetMSAMessage = { type: "setMSA"; msaData: MSAData };
export type RedrawMessage = {
  type: "redraw";
  drawOptions: DrawOptions;
  isMinimap: boolean;
  canvasWidth: number;
  canvasHeight: number;
};
export type DragPreviewMessage = {
  type: "dragPreview";
  dragIndex: number | null;
  hoverIndex: number | null;
};
export type DoneMessage = { type: "done" };
export type CanvasMessage = InitMessage | RedrawMessage | SetMSAMessage | DragPreviewMessage | DoneMessage;
