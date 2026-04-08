import { MSAData, CanvasMessage, DrawOptions } from "./types";

function countBy<T extends string | number>(
  array: T[],
): Record<string, number> {
  return array.reduce<Record<string, number>>((acc, item) => {
    const key = String(item);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

// DNA – default ACGT
const dnaColorMap = new Map([
  ["A", "#4caf50"],
  ["C", "#2196f3"],
  ["G", "#ff9800"],
  ["T", "#f44336"],
  ["U", "#f44336"],
  ["N", "#e0e0e0"],
  ["-", "#f4f4f4"],
]);

// DNA – ClustalX traditional
const dnaClustalX = new Map([
  ["A", "#64F73F"],
  ["C", "#FF7070"],
  ["G", "#FFB340"],
  ["T", "#4AC7FF"],
  ["U", "#4AC7FF"],
  ["-", "#f4f4f4"],
]);

// Amino Acid – ClustalX (Jalview)
const aaClustalX = new Map<string, string>([
  ...["A", "V", "F", "P", "M", "I", "L", "W"].map(
    (c) => [c, "#80A0F0"] as [string, string],
  ),
  ...["K", "R"].map((c) => [c, "#F01505"] as [string, string]),
  ...["D", "E"].map((c) => [c, "#C048C0"] as [string, string]),
  ...["N", "Q", "S", "T"].map((c) => [c, "#15C015"] as [string, string]),
  ["C", "#F08080"],
  ["G", "#F09048"],
  ...["H", "Y"].map((c) => [c, "#15A4A4"] as [string, string]),
  ["-", "#f4f4f4"],
]);

// Amino Acid – Zappo (physicochemical)
const aaZappo = new Map<string, string>([
  ...["I", "L", "V", "A", "M"].map((c) => [c, "#FFAFAF"] as [string, string]),
  ...["F", "W", "Y"].map((c) => [c, "#FFC800"] as [string, string]),
  ...["K", "R", "H"].map((c) => [c, "#6464FF"] as [string, string]),
  ...["D", "E"].map((c) => [c, "#FF0000"] as [string, string]),
  ...["S", "T", "N", "Q"].map((c) => [c, "#00DD00"] as [string, string]),
  ...["G", "P"].map((c) => [c, "#FF00FF"] as [string, string]),
  ["C", "#FFFF00"],
  ["-", "#f4f4f4"],
]);

// Amino Acid – Taylor (spectral by residue index)
const aaTaylor = new Map([
  ["A", "#CCFF00"],
  ["R", "#0000FF"],
  ["N", "#CC00FF"],
  ["D", "#FF0000"],
  ["C", "#FFFF00"],
  ["Q", "#FF00CC"],
  ["E", "#FF0066"],
  ["G", "#FF9900"],
  ["H", "#0066FF"],
  ["I", "#66FF00"],
  ["L", "#33FF00"],
  ["K", "#6600FF"],
  ["M", "#00FF00"],
  ["F", "#00FF66"],
  ["P", "#FFCC00"],
  ["S", "#FF3300"],
  ["T", "#FF6600"],
  ["W", "#00CCFF"],
  ["Y", "#00FFCC"],
  ["V", "#99FF00"],
  ["-", "#f4f4f4"],
]);

function computeConservationScores(msaData: MSAData): number[] {
  const nCols = msaData[0].sequence.length;
  const nRows = msaData.length;
  const scores: number[] = [];
  for (let col = 0; col < nCols; col++) {
    const counts: Record<string, number> = {};
    let total = 0;
    for (let row = 0; row < nRows; row++) {
      const char = msaData[row].sequence[col].toUpperCase();
      if (char !== "-") {
        counts[char] = (counts[char] || 0) + 1;
        total++;
      }
    }
    if (total === 0) {
      scores.push(0);
    } else {
      const max = Math.max(...Object.values(counts));
      scores.push(max / total);
    }
  }
  return scores;
}

function computeConsensus(msaData: MSAData): string[] {
  const nCols = msaData[0].sequence.length;
  const nRows = msaData.length;
  const consensus: string[] = [];
  for (let col = 0; col < nCols; col++) {
    const counts: Record<string, number> = {};
    for (let row = 0; row < nRows; row++) {
      const char = msaData[row].sequence[col].toUpperCase();
      if (char !== "-") counts[char] = (counts[char] || 0) + 1;
    }
    const entries = Object.entries(counts);
    consensus.push(
      entries.length === 0
        ? "-"
        : entries.reduce((a, b) => (b[1] > a[1] ? b : a))[0],
    );
  }
  return consensus;
}

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

class CanvasDrawer {
  private canvas: OffscreenCanvas | null = null;
  private ctx: OffscreenCanvasRenderingContext2D | null = null;
  private msaData: MSAData = [];
  private consensus: string[] = [];
  private parsimonyInformativeSites: number[] = [];
  private conservedSites: number[] = [];
  private variableSites: number[] = [];
  private options: DrawOptions = {
    cellSize: 16,
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
  private conservationScores: number[] = [];

  init(canvas: OffscreenCanvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    postMessage("Initialized worker");
  }

  setMSAData(msaData: MSAData) {
    Object.assign(this, {
      msaData,
      consensus: computeConsensus(msaData),
      conservationScores: computeConservationScores(msaData),
      ...analyseMSAColumns(msaData),
    });
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
        const score = this.conservationScores[col] ?? 0;
        const barH = score * canvasHeight;
        ctx.fillStyle = `hsl(${220 - score * 180}, 70%, 50%)`;
        ctx.fillRect(
          col * cellSize,
          canvasHeight - barH,
          cellSize * 0.95,
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
        const score = this.conservationScores[col] ?? 0;
        const barH = score * canvasHeight;
        ctx.fillStyle = `hsl(${220 - score * 180}, 70%, 50%)`;
        ctx.fillRect(
          col * cellSize,
          canvasHeight - barH,
          cellSize * 0.95,
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
        const char = this.consensus[col] ?? "-";
        ctx.fillStyle = this.charToColor(char, col);
        ctx.fillRect(col * cellSize, 0, cellSize * 0.95, cellSize * 0.95);
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
        const consensusChar = this.consensus[col];
        const matchesConsensus =
          showConsensus && char.toUpperCase() === consensusChar?.toUpperCase();

        ctx.fillStyle = this.charToColor(char, col);
        ctx.fillRect(
          col * cellSize,
          drawRow * cellSize,
          cellSize * 0.95,
          cellSize * 0.95,
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

  private charToColor(char: string, col: number): string {
    const HIGHLIGHT_COLOR = "royalblue";
    const UNKNOWN_COLOR = "#cccccc";
    const GAP_COLOR = "#f4f4f4";
    const upper = char.toUpperCase();
    switch (this.options.colorStyle) {
      case "DNA":
        return dnaColorMap.get(upper) ?? GAP_COLOR;
      case "DNA ClustalX":
        return dnaClustalX.get(upper) ?? GAP_COLOR;
      case "AA ClustalX":
        return aaClustalX.get(upper) ?? GAP_COLOR;
      case "AA Zappo":
        return aaZappo.get(upper) ?? GAP_COLOR;
      case "AA Taylor":
        return aaTaylor.get(upper) ?? GAP_COLOR;
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
const drawer = new CanvasDrawer();

// Message handling
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
