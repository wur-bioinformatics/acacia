import type { JSX } from "react";
import { Y_STEP } from "../constants";

type ScaleBarProps = {
  scaleVal: number;
  scalePx: number;
  nLeaves: number;
};

export default function ScaleBar({ scaleVal, scalePx, nLeaves }: ScaleBarProps): JSX.Element {
  return (
    <g transform={`translate(0, ${nLeaves * Y_STEP + 18})`}>
      <line x1={0} y1={0} x2={scalePx} y2={0} stroke="#555" strokeWidth={1.5} />
      <line x1={0} y1={-4} x2={0} y2={4} stroke="#555" strokeWidth={1.5} />
      <line x1={scalePx} y1={-4} x2={scalePx} y2={4} stroke="#555" strokeWidth={1.5} />
      <text x={scalePx / 2} y={14} textAnchor="middle" fontSize={10} fill="#666">
        {scaleVal}
      </text>
    </g>
  );
}
