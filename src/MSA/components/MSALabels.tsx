import { useState, useRef, type JSX } from "react";
import type { SeqObject } from "../types";
import { CELL_SIZE } from "../constants";
import { useSequenceStore } from "../../sequenceStore";
import { useDrawStore } from "../stores/drawStore";
import { useShallow } from "zustand/react/shallow";

type Props = {
  msaData: SeqObject[];
  showConsensus: boolean;
  offsetY: number;
  width: number;
};

type DragState = {
  index: number;
  rowTop: number;       // initial ghost top (row's viewport Y at pickup)
  grabOffset: number;   // e.clientY - rowTop at pickup — keeps ghost under cursor
  containerLeft: number;
};

function getRowShift(rowIndex: number, dragIndex: number, hoverIndex: number): number {
  if (rowIndex === dragIndex) return 0;
  if (dragIndex < hoverIndex) {
    if (rowIndex > dragIndex && rowIndex <= hoverIndex) return -CELL_SIZE;
  } else {
    if (rowIndex >= hoverIndex && rowIndex < dragIndex) return CELL_SIZE;
  }
  return 0;
}

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

  const [dragging, setDragging] = useState<DragState | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const hoverIndexRef = useRef<number | null>(null);
  const ghostRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Stable ref to dragging so move handler doesn't go stale
  const draggingRef = useRef<DragState | null>(null);

  const nRows = msaData.length + (showConsensus ? 1 : 0);

  function cleanup() {
    setDragging(null);
    draggingRef.current = null;
    setHoverIndex(null);
    hoverIndexRef.current = null;
    setDragState(null);
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>, i: number) {
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    const containerRect = containerRef.current!.getBoundingClientRect();
    const state: DragState = {
      index: i,
      rowTop: rect.top,
      grabOffset: e.clientY - rect.top,
      containerLeft: containerRect.left,
    };
    setDragging(state);
    draggingRef.current = state;
    setHoverIndex(i);
    hoverIndexRef.current = i;
    setDragState({ dragIndex: i, hoverIndex: i });
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const drag = draggingRef.current;
    if (!drag) return;

    // Move ghost via direct DOM mutation — no setState, no re-render per frame
    if (ghostRef.current) {
      ghostRef.current.style.top = `${e.clientY - drag.grabOffset}px`;
    }

    // Compute which row the pointer is over
    const containerRect = containerRef.current!.getBoundingClientRect();
    const consensusOffset = showConsensus ? CELL_SIZE : 0;
    const relativeY = e.clientY - containerRect.top - offsetY - consensusOffset;
    const raw = Math.floor(relativeY / CELL_SIZE);
    const clamped = Math.max(0, Math.min(msaData.length - 1, raw));

    if (clamped !== hoverIndexRef.current) {
      setHoverIndex(clamped);
      hoverIndexRef.current = clamped;
      setDragState({ dragIndex: drag.index, hoverIndex: clamped });
    }
  }

  function handlePointerUp() {
    const drag = draggingRef.current;
    if (!drag) return;
    const to = hoverIndexRef.current;
    if (to !== null && to !== drag.index) {
      moveSequence(drag.index, to);
    }
    cleanup();
  }

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={cleanup}
      style={{
        width,
        height: nRows * CELL_SIZE,
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      <div style={{ transform: `translateY(${offsetY}px)`, position: "relative" }}>
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
        {msaData.map((seq, i) => {
          const isDragged = dragging?.index === i;
          const shift =
            dragging !== null && hoverIndex !== null
              ? getRowShift(i, dragging.index, hoverIndex)
              : 0;
          return (
            <div
              key={seq.identifier}
              onPointerDown={(e) => handlePointerDown(e, i)}
              onMouseEnter={() => setHoverRow(i)}
              onMouseLeave={() => setHoverRow(null)}
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
                cursor: dragging ? "grabbing" : "grab",
                opacity: isDragged ? 0 : (hoverRow === i ? 0.85 : 0.45),
                background: hoverRow === i ? "rgba(48,92,222,0.15)" : undefined,
                transform: `translateY(${shift}px)`,
                transition: isDragged
                  ? "none"
                  : "transform 150ms ease, opacity 80ms ease",
                userSelect: "none",
                touchAction: "none",
                willChange: shift !== 0 ? "transform" : "auto",
              }}
            >
              {seq.identifier}
            </div>
          );
        })}
        {/* Drop indicator */}
        {dragging !== null && hoverIndex !== null && (
          <div
            style={{
              position: "absolute",
              left: 0,
              width: "100%",
              height: 2,
              background: "currentColor",
              opacity: 0.6,
              borderRadius: 1,
              pointerEvents: "none",
              top: hoverIndex * CELL_SIZE + (showConsensus ? CELL_SIZE : 0),
              zIndex: 10,
            }}
          />
        )}
      </div>
      {/* Ghost element — outside the scrolling div, uses position:fixed */}
      {dragging !== null && (
        <div
          ref={ghostRef}
          style={{
            position: "fixed",
            left: dragging.containerLeft,
            top: dragging.rowTop,
            width,
            height: CELL_SIZE,
            lineHeight: `${CELL_SIZE}px`,
            fontSize: 11,
            fontFamily: '"Azeret Mono", ui-monospace, monospace',
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            paddingRight: 8,
            textAlign: "right",
            opacity: 0.9,
            background: "var(--b1)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
            borderRadius: 2,
            cursor: "grabbing",
            pointerEvents: "none",
            zIndex: 100,
          }}
        >
          {msaData[dragging.index].identifier}
        </div>
      )}
    </div>
  );
}
