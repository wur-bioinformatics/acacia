import { type JSX } from "react";
import { useDrawStore } from "../stores/drawStore";
import { computeTicks } from "../utils/scalebarTicks";
import {
  CELL_SIZE,
  CURSOR_RGB,
  CURSOR_RGB_DARK,
  SCALEBAR_HEIGHT,
} from "../constants";

const MAJOR_TICK = 7;
const MINOR_TICK = 4;

/**
 * Column ruler above the main alignment canvas. Shares the canvas pan/zoom, so
 * ticks stay glued to their columns. SVG rather than canvas: the tick count is
 * bounded by the viewport width, and theme tokens colour it for free.
 */
export default function Scalebar({
  width,
  nCols,
}: {
  width: number;
  nCols: number;
}): JSX.Element {
  const offsetX = useDrawStore((s) => s.drawOptions.offsetX);
  const scale = useDrawStore((s) => s.drawOptions.scale);
  const darkMode = useDrawStore((s) => s.drawOptions.darkMode);
  const hoverCol = useDrawStore((s) => s.hoverCell?.col ?? null);

  const pxPerCol = CELL_SIZE * scale;
  const ticks = computeTicks({ nCols, width, offsetX, pxPerCol });
  const cursor = darkMode ? CURSOR_RGB_DARK : CURSOR_RGB;
  const hoverX =
    hoverCol === null ? null : hoverCol * pxPerCol + pxPerCol / 2 + offsetX;

  return (
    <svg
      width={width}
      height={SCALEBAR_HEIGHT}
      className="text-muted-foreground"
      style={{ display: "block", flexShrink: 0 }}
    >
      {/* Baseline the ticks hang from */}
      <line
        x1={0}
        y1={SCALEBAR_HEIGHT - 0.5}
        x2={width}
        y2={SCALEBAR_HEIGHT - 0.5}
        stroke="currentColor"
        strokeWidth={1}
        opacity={0.35}
      />
      {ticks.map((tick) => {
        const isMajor = tick.label !== null;
        return (
          <g key={tick.col}>
            <line
              x1={tick.x}
              y1={SCALEBAR_HEIGHT - (isMajor ? MAJOR_TICK : MINOR_TICK)}
              x2={tick.x}
              y2={SCALEBAR_HEIGHT}
              stroke="currentColor"
              strokeWidth={1}
              opacity={isMajor ? 0.6 : 0.3}
            />
            {isMajor && (
              <text
                x={tick.x}
                y={SCALEBAR_HEIGHT - MAJOR_TICK - 3}
                textAnchor="middle"
                fill="currentColor"
                opacity={0.6}
                style={{
                  fontSize: 9,
                  fontFamily: '"Azeret Mono", ui-monospace, monospace',
                }}
              >
                {tick.label}
              </text>
            )}
          </g>
        );
      })}
      {hoverX !== null && hoverX >= 0 && hoverX <= width && (
        <polygon
          points={`${hoverX - 4},${SCALEBAR_HEIGHT} ${hoverX + 4},${SCALEBAR_HEIGHT} ${hoverX},${SCALEBAR_HEIGHT - 5}`}
          fill={`rgb(${cursor})`}
        />
      )}
    </svg>
  );
}
