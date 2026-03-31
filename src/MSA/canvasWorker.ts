import { MSAData, CanvasMessage, DrawOptions } from "./types";

function countBy<T extends string | number>(
  array: T[]
): Record<string, number> {
  return array.reduce<Record<string, number>>((acc, item) => {
    const key = String(item);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

const colorMap = new Map([
  ["A", "#4caf50"],
  ["C", "#2196f3"],
  ["G", "#ff9800"],
  ["T", "#f44336"],
  ["N", "#f4f4f4"],
  ["-", "#f4f4f4"],
]);

function analyseMSAColumns(msaData: MSAData): {
  parsimonyInformativeSites: number[];
  conservedSites: number[];
  variableSites: number[];
} {
  const parsimonyInformativeSites: number[] = [];
  const conservedSites: number[] = [];
  const variableSites: number[] = [];

  const nCols = msaData[0].sequence.length;
  const nRows = msaData.length;

  for (let col = 0; col < nCols; col++) {
    const colChars: string[] = [];
    for (let row = 0; row < nRows; row++) {
      colChars.push(msaData[row].sequence.slice(col, col + 1));
    }
    const charCounts = countBy(colChars);
    if (Object.keys(charCounts).length == 1) {
      conservedSites.push(col);
    } else {
      if (Math.min(...Object.values(charCounts)) > 1) {
        parsimonyInformativeSites.push(col);
      }
      variableSites.push(col);
    }
  }

  return { parsimonyInformativeSites, conservedSites, variableSites };
}

class MSADrawer {
  private canvas: OffscreenCanvas | null = null;
  private ctx: OffscreenCanvasRenderingContext2D | null = null;
  private msaData: MSAData = [];
  private parsimonyInformativeSites: number[] = [];
  private conservedSites: number[] = [];
  private variableSites: number[] = [];
  private options: DrawOptions = {
    cellSize: 16,
    showLetters: true,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    colorStyle: "Default",
    isMinimap: false,
  };
  private isMinimap: boolean = false;

  init(canvas: OffscreenCanvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    postMessage("Initialized worker");
  }

  setMSAData(msaData: MSAData) {
    Object.assign(this, { msaData, ...analyseMSAColumns(msaData) });
  }

  updateDrawSettings(options: DrawOptions, isMinimap: boolean) {
    this.isMinimap = isMinimap;
    this.options = options;
  }

  redraw() {
    if (!this.ctx || !this.canvas || this.msaData.length === 0) return;
    this.drawMSA();
  }

  drawMSA() {
    const ctx = this.ctx!;
    const { cellSize, showLetters, scale, offsetX, offsetY } = this.options;

    const nRows = this.msaData.length;
    const nCols = this.msaData[0].sequence.length;
    const invScale = 1 / scale;

    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;

    const startCol = this.isMinimap
      ? 0
      : Math.max(0, Math.floor((-offsetX * invScale) / cellSize));
    const endCol = this.isMinimap
      ? nCols
      : Math.min(
          nCols,
          Math.ceil(((canvasWidth - offsetX) * invScale) / cellSize)
        );

    const drawLetters = scale * cellSize >= 10;

    ctx.save();
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    if (this.isMinimap) {
      const scaleX = canvasWidth / (nCols * cellSize);
      const scaleY = canvasHeight / (nRows * cellSize);
      ctx.scale(scaleX, scaleY);
    } else {
      ctx.translate(offsetX, offsetY);
      ctx.scale(scale, 1);
    }

    for (let row = 0; row < nRows; row++) {
      for (let col = startCol; col < endCol; col++) {
        const char = this.msaData[row].sequence[col];
        ctx.fillStyle = this.charToColor(char, col);
        ctx.fillRect(
          col * cellSize,
          row * cellSize,
          cellSize * 0.95,
          cellSize * 0.95
        );

        if (showLetters && drawLetters && !this.isMinimap) {
          ctx.fillStyle = "black";
          ctx.font = `${cellSize * 0.6}px monospace`;
          ctx.textBaseline = "middle";
          ctx.textAlign = "center";
          ctx.fillText(
            char,
            col * cellSize + cellSize / 2,
            row * cellSize + cellSize / 2
          );
        }
      }
    }

    ctx.restore();
  }

  private charToColor(char: string, col: number): string {
    const HIGHLIGHT_COLOR = "royalblue";
    const UNKNOWN_COLOR = "grey";
    const GAP_COLOR = "#f4f4f4";
    switch (this.options.colorStyle) {
      case "Default":
        return colorMap.get(char) || UNKNOWN_COLOR;
      case "Parsimony Informative":
        return this.parsimonyInformativeSites.indexOf(col) > -1
          ? HIGHLIGHT_COLOR
          : GAP_COLOR;
      case "Variable":
        return this.variableSites.indexOf(col) > -1
          ? HIGHLIGHT_COLOR
          : GAP_COLOR;
      case "Conserved":
        return this.conservedSites.indexOf(col) > -1
          ? HIGHLIGHT_COLOR
          : GAP_COLOR;
      default:
        return UNKNOWN_COLOR;
    }
  }
}

postMessage("loaded");

// Instantiate the drawer
const drawer = new MSADrawer();

// Message handling
self.onmessage = (e: MessageEvent<CanvasMessage>) => {
  const { type } = e.data;

  if (type === "init") {
    drawer.init(e.data.canvas);
  } else if (type === "setMSA") {
    drawer.setMSAData(e.data.msaData);
  } else if (type === "redraw") {
    const { drawOptions, isMinimap } = e.data;
    drawer.updateDrawSettings(drawOptions, isMinimap);
    drawer.redraw();
  }
};
