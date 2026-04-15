import { useState, useRef, type JSX } from "react";
import type { SeqObject } from "../types";
import { CELL_SIZE } from "../constants";
import { useSequenceStore } from "../../sequenceStore";

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
  const { moveSequence } = useSequenceStore();
  const dragIndexRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

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
            key={seq.identifier}
            draggable
            onDragStart={() => {
              dragIndexRef.current = i;
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverIndex(i);
            }}
            onDrop={() => {
              if (dragIndexRef.current !== null && dragIndexRef.current !== i) {
                moveSequence(dragIndexRef.current, i);
              }
              dragIndexRef.current = null;
              setDragOverIndex(null);
            }}
            onDragEnd={() => {
              dragIndexRef.current = null;
              setDragOverIndex(null);
            }}
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
              cursor: "grab",
              opacity: dragOverIndex === i ? 0.8 : 0.45,
              outline: dragOverIndex === i ? "1px solid currentColor" : undefined,
            }}
          >
            {seq.identifier}
          </div>
        ))}
      </div>
    </div>
  );
}
