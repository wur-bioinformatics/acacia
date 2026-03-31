export const COLORSTYLES = [
  "Default",
  "Parsimony Informative",
  "Conserved",
  "Variable",
] as const;
export type ColorStyle = (typeof COLORSTYLES)[number];

export type DrawOptions = {
  cellSize: number;
  showLetters: boolean;
  scale: number;
  isMinimap: boolean;
  offsetX: number;
  offsetY: number;
  colorStyle: ColorStyle;
};

export type SeqObject = {
  header: string;
  sequence: string;
};

export type MSAData = SeqObject[];

export type InitMessage = { type: "init"; canvas: OffscreenCanvas };
export type SetMSAMessage = { type: "setMSA"; msaData: MSAData };
export type RedrawMessage = {
  type: "redraw";
  drawOptions: DrawOptions;
  isMinimap: boolean;
};
export type CanvasMessage = InitMessage | RedrawMessage | SetMSAMessage;
