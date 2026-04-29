import { type JSX } from "react";
import type { SeqObject } from "../types";
import { CELL_SIZE } from "../constants";
import { useSequenceStore } from "../../sequenceStore";
import { useDrawStore } from "../stores/drawStore";
import { useShallow } from "zustand/react/shallow";
import SequenceLabels from "../../SequenceLabels";

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
  const { setDragState, hoverRow, setHoverRow } = useDrawStore(
    useShallow((s) => ({ setDragState: s.setDragState, hoverRow: s.hoverRow, setHoverRow: s.setHoverRow }))
  );

  const nRows = msaData.length + (showConsensus ? 1 : 0);
  const entries = msaData.map((seq) => ({ id: seq.identifier }));

  return (
    <div
      style={{
        width,
        height: nRows * CELL_SIZE,
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      {showConsensus && (
        <div
          style={{
            height: CELL_SIZE,
            lineHeight: `${CELL_SIZE}px`,
            fontSize: 11,
            fontFamily: '"Azeret Mono", ui-monospace, monospace',
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
      <SequenceLabels
        entries={entries}
        rowHeight={CELL_SIZE}
        width={width}
        containerHeight={msaData.length * CELL_SIZE}
        offsetY={offsetY}
        textAlign="right"
        fontSize={11}
        showRemove
        onReorder={moveSequence}
        onDragChange={setDragState}
        hoverRow={hoverRow}
        onHoverRow={setHoverRow}
      />
    </div>
  );
}
