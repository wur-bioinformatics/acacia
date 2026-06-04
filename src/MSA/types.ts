export type SequenceType = "DNA" | "Protein";
export type TrackType = "conservation" | "logo" | "trident" | "tcs";

export const COLORSTYLES = [
  "DNA",
  "DNA ClustalX",
  "AA ClustalX",
  "AA Zappo",
  "AA Taylor",
  "Parsimony Informative",
  "Conserved",
  "% Conserved",
  "Variable",
  "TRIDENT",
  "TCS",
] as const;
export type ColorStyle = (typeof COLORSTYLES)[number];

export type DrawOptions = {
  cellSize: number;
  showLetters: boolean;
  showConsensus: boolean;
  /** When consensus is shown, render residues matching the consensus as a "·"
   * so only differences stand out. When false, all letters are drawn. */
  showOnlyDifferences: boolean;
  showLabels: boolean;
  showMinimap: boolean;
  scale: number;
  isMinimap: boolean;
  offsetX: number;
  offsetY: number;
  colorStyle: ColorStyle;
  /** Threshold (0–1) for the "% Conserved" color style: columns whose gap-aware
   * identity is ≥ this value are highlighted. */
  conservationThreshold: number;
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
  /** Fraction of ALL rows (gaps counted as mismatches) that match the dominant
   * character (0–1). Gappy columns score lower than `score`. */
  identity: number;
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
export type SetQualityMessage = {
  type: "setQuality";
  trident: number[] | null;
  tcs: number[][] | null;
};
export type DoneMessage = { type: "done" };
export type CanvasMessage =
  | InitMessage
  | RedrawMessage
  | SetMSAMessage
  | DragPreviewMessage
  | SetQualityMessage
  | DoneMessage;

export type QualityStage = "library" | "scoring";
export type QualityMetric = "trident" | "tcs";
export type QualityRunMessage = {
  type: "runQuality";
  metric: QualityMetric;
  msaData: MSAData;
  sequenceType: SequenceType;
};
export type QualityResponseMessage =
  | { type: "tridentResult"; trident: number[] }
  | { type: "tcsResult"; tcs: number[][]; tcsColMean: number[] }
  | { type: "qualityError"; metric: QualityMetric; error: string }
  | { type: "qualityProgress"; metric: QualityMetric; stage: QualityStage; current: number; total: number };
