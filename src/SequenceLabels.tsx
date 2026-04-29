import { useState, useRef, type JSX } from "react";
import { useEditStore } from "./editStore";
import { resolveDisplayName } from "./editUtils";
import { useShallow } from "zustand/react/shallow";

export type LabelEntry = {
  id: string;          // original sequence identifier — used for editStore name lookup and drag key
  label?: string;      // if set, shown as-is (bypasses editStore); also disables rename + drag
  draggable?: boolean; // default true; ignored when label is set
  entryStyle?: { color?: string; fontWeight?: string; fontStyle?: string };
};

type DragState = {
  index: number;
  rowTop: number;
  grabOffset: number;
  containerLeft: number;
};

const DRAG_THRESHOLD = 4;

function getRowShift(rowIndex: number, dragIndex: number, hoverIndex: number, rowHeight: number): number {
  if (rowIndex === dragIndex) return 0;
  if (dragIndex < hoverIndex) {
    if (rowIndex > dragIndex && rowIndex <= hoverIndex) return -rowHeight;
  } else {
    if (rowIndex >= hoverIndex && rowIndex < dragIndex) return rowHeight;
  }
  return 0;
}

type Props = {
  entries: LabelEntry[];
  rowHeight: number;
  width: number;
  containerHeight: number;
  paddingTop?: number;      // vertical offset before first row (tree: MARGIN.top - yStep/2)
  offsetY?: number;         // virtual scroll translateY (MSA only)
  textAlign?: "left" | "right";
  fontSize?: number;
  showRemove?: boolean;
  onReorder?: (from: number, to: number) => void;
  onDragChange?: (state: { dragIndex: number; hoverIndex: number } | null) => void;
  hoverRow?: number | null;
  onHoverRow?: (row: number | null) => void;
  containerRef?: React.Ref<HTMLDivElement>;
  animateShifts?: boolean;  // default true; false for instant shifts (tree drag syncs with SVG)
};

export default function SequenceLabels({
  entries,
  rowHeight,
  width,
  containerHeight,
  paddingTop = 0,
  offsetY = 0,
  textAlign = "left",
  fontSize = 12,
  showRemove = false,
  onReorder,
  onDragChange,
  hoverRow,
  onHoverRow,
  containerRef,
  animateShifts = true,
}: Props): JSX.Element {
  const { edits, addEdit } = useEditStore(
    useShallow((s) => ({ edits: s.edits, addEdit: s.addEdit }))
  );

  const [dragging, setDragging] = useState<DragState | null>(null);
  const [internalHoverRow, setInternalHoverRow] = useState<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const hoverIndexRef = useRef<number | null>(null);
  const ghostRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef<DragState | null>(null);
  const pendingRef = useRef<{ x: number; y: number; state: DragState } | null>(null);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  function cleanup() {
    pendingRef.current = null;
    setDragging(null);
    draggingRef.current = null;
    setHoverIndex(null);
    hoverIndexRef.current = null;
    onDragChange?.(null);
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>, i: number) {
    if (renamingId !== null || !onReorder) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    const containerRect = innerRef.current!.getBoundingClientRect();
    const state: DragState = {
      index: i,
      rowTop: rect.top,
      grabOffset: e.clientY - rect.top,
      containerLeft: containerRect.left,
    };
    pendingRef.current = { x: e.clientX, y: e.clientY, state };
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (pendingRef.current && !draggingRef.current) {
      const dx = e.clientX - pendingRef.current.x;
      const dy = e.clientY - pendingRef.current.y;
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      const { state } = pendingRef.current;
      draggingRef.current = state;
      setDragging(state);
      setHoverIndex(state.index);
      hoverIndexRef.current = state.index;
      onDragChange?.({ dragIndex: state.index, hoverIndex: state.index });
      pendingRef.current = null;
    }

    const drag = draggingRef.current;
    if (!drag) return;

    if (ghostRef.current) {
      ghostRef.current.style.top = `${e.clientY - drag.grabOffset}px`;
    }

    // innerRef has transform:translateY(offsetY) applied, so getBoundingClientRect().top
    // already accounts for the scroll offset — do NOT subtract offsetY again.
    const containerRect = innerRef.current!.getBoundingClientRect();
    const relativeY = e.clientY - containerRect.top - paddingTop;
    const raw = Math.floor(relativeY / rowHeight);
    const clamped = Math.max(0, Math.min(entries.length - 1, raw));

    if (clamped !== hoverIndexRef.current) {
      setHoverIndex(clamped);
      hoverIndexRef.current = clamped;
      onDragChange?.({ dragIndex: drag.index, hoverIndex: clamped });
    }
  }

  function handlePointerUp() {
    pendingRef.current = null;
    const drag = draggingRef.current;
    if (!drag) return;
    const to = hoverIndexRef.current;
    if (to !== null && to !== drag.index) {
      onReorder?.(drag.index, to);
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

  const paddingProp = textAlign === "right" ? { paddingRight: 8 } : { paddingLeft: 8 };

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={cleanup}
      style={{ width, height: containerHeight, overflow: "hidden", flexShrink: 0 }}
    >
      <div
        ref={innerRef}
        style={{ transform: `translateY(${offsetY}px)`, paddingTop, position: "relative" }}
      >
        {entries.map((entry, i) => {
          const isDraggable = !entry.label && (entry.draggable ?? true);
          const isDragged = dragging?.index === i;
          const shift =
            dragging !== null && hoverIndex !== null
              ? getRowShift(i, dragging.index, hoverIndex, rowHeight)
              : 0;
          const isRenaming = !entry.label && renamingId === entry.id;
          const displayName = entry.label ?? resolveDisplayName(entry.id, edits);
          // External hoverRow (e.g. canvas sync in MSA) takes precedence; fall back to internal pointer state
          const effectiveHoverRow = hoverRow ?? internalHoverRow;
          const isHovered = !dragging && effectiveHoverRow === i;

          return (
            <div
              key={entry.id}
              onPointerDown={isDraggable ? (e) => handlePointerDown(e, i) : undefined}
              onMouseEnter={() => {
                setInternalHoverRow(i);
                onHoverRow?.(i);
              }}
              onMouseLeave={() => {
                setInternalHoverRow(null);
                onHoverRow?.(null);
              }}
              style={{
                height: rowHeight,
                lineHeight: `${rowHeight}px`,
                fontSize,
                fontFamily: '"Azeret Mono", ui-monospace, monospace',
                overflow: "hidden",
                whiteSpace: "nowrap",
                ...paddingProp,
                textAlign,
                cursor: dragging
                  ? "grabbing"
                  : isRenaming
                  ? "text"
                  : isDraggable
                  ? "grab"
                  : "default",
                opacity: isDragged ? 0 : isHovered ? 0.85 : 0.45,
                background: isHovered ? "rgba(48,92,222,0.15)" : undefined,
                color: entry.entryStyle?.color,
                fontWeight: entry.entryStyle?.fontWeight,
                fontStyle: entry.entryStyle?.fontStyle,
                transform: `translateY(${shift}px)`,
                transition: isDragged || !animateShifts
                  ? "none"
                  : "transform 150ms ease, opacity 80ms ease",
                userSelect: "none",
                touchAction: "none",
                willChange: shift !== 0 ? "transform" : "auto",
                display: "flex",
                alignItems: "center",
                justifyContent: textAlign === "right" ? "flex-end" : "flex-start",
                gap: 2,
              }}
            >
              {/* Action buttons — only for non-label, hoverable rows */}
              {!entry.label && isHovered && !isRenaming && (
                <>
                  <button
                    title="Rename sequence"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setRenamingId(entry.id);
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
                  {showRemove && (
                    <button
                      title="Remove sequence"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        addEdit({ type: "remove_row", originalId: entry.id });
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
                  )}
                </>
              )}
              {isRenaming ? (
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => commitRename(entry.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename(entry.id);
                    if (e.key === "Escape") setRenamingId(null);
                    e.stopPropagation();
                  }}
                  style={{
                    width: "100%",
                    fontSize,
                    fontFamily: '"Azeret Mono", ui-monospace, monospace',
                    textAlign,
                    background: "var(--color-base-100)",
                    border: "1px solid var(--color-base-300)",
                    borderRadius: 2,
                    padding: "0 4px",
                    height: rowHeight - 2,
                    userSelect: "text",
                  }}
                />
              ) : (
                <span
                  onDoubleClick={
                    !entry.label
                      ? (e) => {
                          e.stopPropagation();
                          setRenamingId(entry.id);
                          setDraft(displayName);
                        }
                      : undefined
                  }
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    cursor: !entry.label ? "text" : "default",
                  }}
                >
                  {displayName}
                </span>
              )}
            </div>
          );
        })}

        {/* Drop indicator — position:absolute is relative to content area (after paddingTop) */}
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
              top: hoverIndex * rowHeight,
              zIndex: 10,
            }}
          />
        )}
      </div>

      {/* Ghost — position:fixed so it escapes overflow:hidden */}
      {dragging !== null && (
        <div
          ref={ghostRef}
          style={{
            position: "fixed",
            left: dragging.containerLeft,
            top: dragging.rowTop,
            width,
            height: rowHeight,
            lineHeight: `${rowHeight}px`,
            fontSize,
            fontFamily: '"Azeret Mono", ui-monospace, monospace',
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            ...(textAlign === "right" ? { paddingRight: 8, textAlign: "right" } : { paddingLeft: 8 }),
            opacity: 0.9,
            background: "var(--color-base-100)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
            borderRadius: 2,
            cursor: "grabbing",
            pointerEvents: "none",
            zIndex: 100,
          }}
        >
          {resolveDisplayName(entries[dragging.index].id, edits)}
        </div>
      )}
    </div>
  );
}
