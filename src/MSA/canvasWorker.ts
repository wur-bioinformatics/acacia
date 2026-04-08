import { MSAData, CanvasMessage, DrawOptions } from "./types";
import {
  computeColumnStats,
  computeConsensus,
  computeConservationScores,
  analyseMSAColumns,
  type ColumnStat,
} from "./utils/msaAnalysis";
import { charToColor, type ColumnAnalysis } from "./colourSchemes";
import { CELL_SIZE, CELL_FILL_RATIO } from "./constants";

class CanvasDrawer {
  private canvas: OffscreenCanvas | null = null;
  private ctx: OffscreenCanvasRenderingContext2D | null = null;
  private msaData: MSAData = [];
  private columnStats: ColumnStat[] = [];
  private analysis: ColumnAnalysis = {
    parsimonyInformativeSites: [],
    conservedSites: [],
    variableSites: [],
  };
  private options: DrawOptions = {
    cellSize: CELL_SIZE,
    showLetters: true,
    showConsensus: false,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    colorStyle: "DNA",
    isMinimap: false,
    isConservation: false,
  };
  private isMinimap: boolean = false;

  init(canvas: OffscreenCanvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    postMessage("Initialized worker");
  }

  setMSAData(msaData: MSAData) {
    this.msaData = msaData;
    this.columnStats = computeColumnStats(msaData);
    this.analysis = analyseMSAColumns(msaData);
  }

  updateDrawSettings(options: DrawOptions, isMinimap: boolean) {
    this.isMinimap = isMinimap;
    this.options = options;
  }

  resize(width: number, height: number) {
    if (!this.canvas) return;
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
  }

  redraw() {
    if (!this.ctx || !this.canvas || this.msaData.length === 0) return;
    if (this.options.isConservation && this.isMinimap) {
      this.drawConservation();
    } else {
      this.drawMSA();
    }
  }

  drawConservation() {
    const ctx = this.ctx!;
    const { cellSize, scale, offsetX } = this.options;
    const conservationScores = computeConservationScores(this.columnStats);
    const nCols = this.msaData[0].sequence.length;
    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;
    const invScale = 1 / scale;

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    if (this.isMinimap) {
      const scaleX = canvasWidth / (nCols * cellSize);
      ctx.save();
      ctx.scale(scaleX, 1);
      for (let col = 0; col < nCols; col++) {
        const score = conservationScores[col] ?? 0;
        const barH = score * canvasHeight;
        ctx.fillStyle = `hsl(${220 - score * 180}, 70%, 50%)`;
        ctx.fillRect(
          col * cellSize,
          canvasHeight - barH,
          cellSize * CELL_FILL_RATIO,
          barH,
        );
      }
      ctx.restore();
    } else {
      const startCol = Math.max(
        0,
        Math.floor((-offsetX * invScale) / cellSize),
      );
      const endCol = Math.min(
        nCols,
        Math.ceil(((canvasWidth - offsetX) * invScale) / cellSize),
      );

      ctx.save();
      ctx.translate(offsetX, 0);
      ctx.scale(scale, 1);

      for (let col = startCol; col < endCol; col++) {
        const score = conservationScores[col] ?? 0;
        const barH = score * canvasHeight;
        ctx.fillStyle = `hsl(${220 - score * 180}, 70%, 50%)`;
        ctx.fillRect(
          col * cellSize,
          canvasHeight - barH,
          cellSize * CELL_FILL_RATIO,
          barH,
        );
      }
      ctx.restore();
    }
  }

  drawMSA() {
    const ctx = this.ctx!;
    const { cellSize, showLetters, showConsensus, scale, offsetX, offsetY } =
      this.options;
    const consensus = computeConsensus(this.columnStats);

    const nRows = this.msaData.length;
    const nCols = this.msaData[0].sequence.length;
    const totalRows = showConsensus ? nRows + 1 : nRows;
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
          Math.ceil(((canvasWidth - offsetX) * invScale) / cellSize),
        );

    const drawLetters = scale * cellSize >= 10;

    ctx.save();
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    if (this.isMinimap) {
      const scaleX = canvasWidth / (nCols * cellSize);
      const scaleY = canvasHeight / (totalRows * cellSize);
      ctx.scale(scaleX, scaleY);
    } else {
      ctx.translate(offsetX, offsetY);
      ctx.scale(scale, 1);
    }

    // Consensus row (row 0)
    if (showConsensus) {
      for (let col = startCol; col < endCol; col++) {
        const char = consensus[col] ?? "-";
        ctx.fillStyle = charToColor(
          char,
          col,
          this.options.colorStyle,
          this.analysis,
        );
        ctx.fillRect(
          col * cellSize,
          0,
          cellSize * CELL_FILL_RATIO,
          cellSize * CELL_FILL_RATIO,
        );
        if (showLetters && drawLetters && !this.isMinimap) {
          ctx.fillStyle = "black";
          ctx.font = `bold ${cellSize * 0.6}px monospace`;
          ctx.textBaseline = "middle";
          ctx.textAlign = "center";
          ctx.fillText(char, col * cellSize + cellSize / 2, cellSize / 2);
        }
      }
    }

    // Sequence rows
    for (let row = 0; row < nRows; row++) {
      const drawRow = showConsensus ? row + 1 : row;
      for (let col = startCol; col < endCol; col++) {
        const char = this.msaData[row].sequence[col];
        const consensusChar = consensus[col];
        const matchesConsensus =
          showConsensus && char.toUpperCase() === consensusChar?.toUpperCase();

        ctx.fillStyle = charToColor(
          char,
          col,
          this.options.colorStyle,
          this.analysis,
        );
        ctx.fillRect(
          col * cellSize,
          drawRow * cellSize,
          cellSize * CELL_FILL_RATIO,
          cellSize * CELL_FILL_RATIO,
        );

        if (showLetters && drawLetters && !this.isMinimap) {
          const label = matchesConsensus ? "·" : char;
          ctx.fillStyle = "black";
          ctx.font = `${cellSize * 0.6}px monospace`;
          ctx.textBaseline = "middle";
          ctx.textAlign = "center";
          ctx.fillText(
            label,
            col * cellSize + cellSize / 2,
            drawRow * cellSize + cellSize / 2,
          );
        }
      }
    }

    ctx.restore();
  }
}

postMessage("loaded");

const drawer = new CanvasDrawer();

self.onmessage = (e: MessageEvent<CanvasMessage>) => {
  const { type } = e.data;

  if (type === "init") {
    drawer.init(e.data.canvas);
  } else if (type === "setMSA") {
    drawer.setMSAData(e.data.msaData);
  } else if (type === "redraw") {
    const { drawOptions, isMinimap, canvasWidth, canvasHeight } = e.data;
    drawer.resize(canvasWidth, canvasHeight);
    drawer.updateDrawSettings(drawOptions, isMinimap);
    drawer.redraw();
  }
};
