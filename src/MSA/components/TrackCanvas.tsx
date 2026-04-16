import { useEffect, useRef, type JSX } from "react";
import { useDrawStore } from "../stores/drawStore";
import { computeConservationScores } from "../utils/msaAnalysis";
import { CELL_SIZE, CELL_FILL_RATIO } from "../constants";
import type { TrackType, MSAColumnStat, MSAColumnAnalysis } from "../types";
import { charToColor } from "../colourSchemes";

export default function TrackCanvas({
  width,
  height,
  trackType,
  columnStats,
  analysis,
}: {
  width: number;
  height: number;
  trackType: TrackType;
  columnStats: MSAColumnStat[];
  analysis: MSAColumnAnalysis;
}): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offsetX = useDrawStore((s) => s.drawOptions.offsetX);
  const scale = useDrawStore((s) => s.drawOptions.scale);
  const colorStyle = useDrawStore((s) => s.drawOptions.colorStyle);
  const darkMode = useDrawStore((s) => s.drawOptions.darkMode);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || columnStats.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    const nCols = columnStats.length;
    const invScale = 1 / scale;
    const startCol = Math.max(0, Math.floor((-offsetX * invScale) / CELL_SIZE));
    const endCol = Math.min(nCols, Math.ceil(((width - offsetX) * invScale) / CELL_SIZE));

    ctx.save();
    ctx.translate(offsetX, 0);
    ctx.scale(scale, 1);

    if (trackType === "conservation") {
      const scores = computeConservationScores(columnStats);
      for (let col = startCol; col < endCol; col++) {
        const score = scores[col] ?? 0;
        const barH = score * height;
        ctx.fillStyle = `hsl(${220 - score * 180}, 70%, 50%)`;
        ctx.fillRect(col * CELL_SIZE, height - barH, CELL_SIZE * CELL_FILL_RATIO, barH);
      }
    } else if (trackType === "logo") {
      const cellW = CELL_SIZE * CELL_FILL_RATIO;
      const REF = 200;
      ctx.font = `${REF}px "Azeret Mono", ui-monospace, monospace`;
      ctx.textBaseline = "alphabetic";
      const refMetrics = ctx.measureText("M");
      const capH = refMetrics.actualBoundingBoxAscent + refMetrics.actualBoundingBoxDescent;

      for (let col = startCol; col < endCol; col++) {
        const stat = columnStats[col];
        const total = Object.values(stat.counts).reduce((s, n) => s + n, 0);
        if (total === 0) continue;

        // Sort ascending so most-frequent char ends up at the bottom
        const entries = Object.entries(stat.counts).sort((a, b) => a[1] - b[1]);
        const colH = stat.score * height;
        let y = height - colH;

        for (const [char, count] of entries) {
          const charH = (count / total) * colH;

          if (charH < 3) {
            // Too small for a legible letter — draw a thin bar
            ctx.fillStyle = charToColor(char, col, colorStyle, analysis, darkMode);
            ctx.fillRect(col * CELL_SIZE, y, cellW, charH);
          } else {
            ctx.save();
            ctx.font = `${REF}px "Azeret Mono", ui-monospace, monospace`;
            ctx.textBaseline = "alphabetic";
            const tw = ctx.measureText(char).width;
            const sx = cellW / tw;
            const sy = charH / capH;
            ctx.translate(col * CELL_SIZE, y);
            ctx.scale(sx, sy);
            ctx.fillStyle = charToColor(char, col, colorStyle, analysis, darkMode);
            // Drawing at actualBoundingBoxAscent places the glyph top exactly at the
            // translated origin (y), so the glyph fills [y, y+charH] precisely.
            ctx.fillText(char, 0, refMetrics.actualBoundingBoxAscent);
            ctx.restore();
          }

          y += charH;
        }
      }
    }

    ctx.restore();
  }, [offsetX, scale, width, height, trackType, columnStats, colorStyle, analysis, darkMode]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ display: "block" }}
    />
  );
}
