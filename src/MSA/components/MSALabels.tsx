import { useState, useRef, type JSX } from "react";
import type { SeqObject } from "../types";
import { CELL_SIZE } from "../constants";
import { useSequenceStore } from "../../sequenceStore";
import { useDrawStore } from "../stores/drawStore";
import { useEditStore } from "../../editStore";
import { resolveDisplayName } from "../../editUtils";
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

const DRAG_THRESHOLD = 4; // px — drag only commits after moving this far

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
  const { edits, addEdit } = useEditStore(
    useShallow((s) => ({ edits: s.edits, addEdit: s.addEdit }))
  );

  const [dragging, setDragging] = useState<DragState | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const hoverIndexRef = useRef<number | null>(null);
  const ghostRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef<DragState | null>(null);
  const pendingRef = useRef<{ x: number; y: number; state: DragState } | null>(null);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const nRows = msaData.length + (showConsensus ? 1 : 0);

  function cleanup() {
    pendingRef.current = null;
    setDragging(null);
    draggingRef.current = null;
    setHoverIndex(null);
    hoverIndexRef.current = null;
    setDragState(null);
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>, i: number) {
    if (renamingId !== null) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    const containerRect = containerRef.current!.getBoundingClientRect();
    const state: DragState = {
      index: i,
      rowTop: rect.top,
      grabOffset: e.clientY - rect.top,
      containerLeft: containerRect.left,
    };
    // Don't commit to drag yet — wait for DRAG_THRESHOLD movement
    pendingRef.current = { x: e.clientX, y: e.clientY, state };
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    // Commit pending drag once pointer has moved past the threshold
    if (pendingRef.current && !draggingRef.current) {
      const dx = e.clientX - pendingRef.current.x;
      const dy = e.clientY - pendingRef.current.y;
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      const { state } = pendingRef.current;
      draggingRef.current = state;
      setDragging(state);
      setHoverIndex(state.index);
      hoverIndexRef.current = state.index;
      setDragState({ dragIndex: state.index, hoverIndex: state.index });
      pendingRef.current = null;
    }

    const drag = draggingRef.current;
    if (!drag) return;

    if (ghostRef.current) {
      ghostRef.current.style.top = `${e.clientY - drag.grabOffset}px`;
    }

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
    pendingRef.current = null;
    const drag = draggingRef.current;
    if (!drag) return;
    const to = hoverIndexRef.current;
    if (to !== null && to !== drag.index) {
      moveSequence(drag.index, to);
    }
    cleanup();
  }

  function commitRename(originalId: string) {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== resolveDisplayName(originalId, edits)) {
      addEdit({ type: "rename", originalId, newName: trimmed });
    }
    setRenamingId(null);
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
          const isHovered = hoverRow === i;
          const isRenaming = renamingId === seq.identifier;
          const displayName = resolveDisplayName(seq.identifier, edits);

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
                whiteSpace: "nowrap",
                paddingRight: 8,
                textAlign: "right",
                cursor: dragging ? "grabbing" : (isRenaming ? "text" : "grab"),
                opacity: isDragged ? 0 : (isHovered ? 0.85 : 0.45),
                background: isHovered ? "rgba(48,92,222,0.15)" : undefined,
                transform: `translateY(${shift}px)`,
                transition: isDragged
                  ? "none"
                  : "transform 150ms ease, opacity 80ms ease",
                userSelect: "none",
                touchAction: "none",
                willChange: shift !== 0 ? "transform" : "auto",
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 2,
              }}
            >
              {isHovered && !isRenaming && (
                <>
                  <button
                    title="Rename sequence"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setRenamingId(seq.identifier);
                      setDraft(displayName);
                    }}
                    style={{
                      flexShrink: 0,
                      lineHeight: 1,
                      padding: "0 2px",
                      opacity: 0.5,
                      cursor: "pointer",
                      background: "none",
                      border: "none",
                      color: "currentColor",
                    }}
                    className="hover:opacity-100 transition-opacity"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                  <button
                    title="Remove sequence"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      addEdit({ type: "remove_row", originalId: seq.identifier });
                    }}
                    style={{
                      flexShrink: 0,
                      lineHeight: 1,
                      padding: "0 2px",
                      fontSize: 13,
                      opacity: 0.5,
                      cursor: "pointer",
                      background: "none",
                      border: "none",
                      color: "currentColor",
                    }}
                    className="hover:opacity-100 transition-opacity"
                  >
                    ×
                  </button>
                </>
              )}
              {isRenaming ? (
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => commitRename(seq.identifier)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename(seq.identifier);
                    if (e.key === "Escape") setRenamingId(null);
                    e.stopPropagation();
                  }}
                  style={{
                    width: "100%",
                    fontSize: 11,
                    fontFamily: '"Azeret Mono", ui-monospace, monospace',
                    textAlign: "right",
                    background: "var(--color-base-100)",
                    border: "1px solid var(--color-base-300)",
                    borderRadius: 2,
                    padding: "0 4px",
                    height: CELL_SIZE - 2,
                    userSelect: "text",
                  }}
                />
              ) : (
                <span
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setRenamingId(seq.identifier);
                    setDraft(displayName);
                  }}
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {displayName}
                </span>
              )}
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
          {resolveDisplayName(msaData[dragging.index].identifier, edits)}
        </div>
      )}
    </div>
  );
}
