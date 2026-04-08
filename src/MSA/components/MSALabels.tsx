import type { JSX } from "react";
import type { SeqObject } from "../types";
import { CELL_SIZE } from "../constants";

type Props = {
  msaData: SeqObject[];
  showConsensus: boolean;
  offsetY: number;
  width: number;
};

export default function MSALabels({
  msaData,
  showConsensus,
  offsetY,
  width,
}: Props): JSX.Element {
  const nRows = msaData.length + (showConsensus ? 1 : 0);
  return (
    <div
      style={{
        width,
        height: nRows * CELL_SIZE,
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      <div style={{ transform: `translateY(${offsetY}px)` }}>
        {showConsensus && (
          <div
            style={{
              height: CELL_SIZE,
              lineHeight: `${CELL_SIZE}px`,
              fontSize: 11,
              fontFamily: "monospace",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              paddingRight: 8,
              textAlign: "right",
              fontWeight: "bold",
              opacity: 0.7,
            }}
          >
            Consensus
          </div>
        )}
        {msaData.map((seq, i) => (
          <div
            key={i}
            style={{
              height: CELL_SIZE,
              lineHeight: `${CELL_SIZE}px`,
              fontSize: 11,
              fontFamily: "monospace",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              paddingRight: 8,
              textAlign: "right",
              opacity: 0.45,
            }}
          >
            {seq.identifier}
          </div>
        ))}
      </div>
    </div>
  );
}
