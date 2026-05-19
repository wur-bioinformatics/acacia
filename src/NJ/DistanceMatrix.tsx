import type { JSX } from "react";
import { useRef, useState } from "react";
import { useNJStore } from "./njStore";
import { useSequenceStore } from "../sequenceStore";
import { useEditStore } from "../editStore";
import { resolveDisplayName } from "../editUtils";
import { useShallow } from "zustand/react/shallow";
import UndoRedoButtons from "../UndoRedoButtons";
import SequenceLabels from "../SequenceLabels";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { HelpButton } from "../docs/HelpButton";

const CELL_WIDTH = 44;
const CELL_HEIGHT = 22;
const HEADER_HEIGHT = 100;
const DIVIDER_WIDTH = 8;
const DEFAULT_LABEL_WIDTH = 160;

type ColorScheme = "warm" | "cool" | "green" | "grayscale";

const COLOR_SCHEMES: { value: ColorScheme; label: string }[] = [
  { value: "warm", label: "Warm" },
  { value: "cool", label: "Cool" },
  { value: "green", label: "Green" },
  { value: "grayscale", label: "Grayscale" },
];

function cellBg(intensity: number, scheme: ColorScheme): { r: number; g: number; b: number } {
  switch (scheme) {
    case "warm":
      return { r: Math.round(255 * (1 - intensity * 0.6)), g: Math.round(255 * (1 - intensity)), b: Math.round(255 * (1 - intensity)) };
    case "cool":
      return { r: Math.round(255 * (1 - intensity)), g: Math.round(255 * (1 - intensity)), b: Math.round(255 * (1 - intensity * 0.6)) };
    case "green":
      return { r: Math.round(255 * (1 - intensity)), g: Math.round(255 * (1 - intensity * 0.6)), b: Math.round(255 * (1 - intensity)) };
    case "grayscale": {
      const v = Math.round(255 * (1 - intensity));
      return { r: v, g: v, b: v };
    }
  }
}

function contrastColor(r: number, g: number, b: number): string {
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const L = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  return L > 0.179 ? "#000000" : "#ffffff";
}

function useLabelDividerResize() {
  const [labelWidth, setLabelWidth] = useState(DEFAULT_LABEL_WIDTH);
  const dragState = useRef<{ startX: number; startWidth: number } | null>(null);

  function onMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    dragState.current = { startX: e.clientX, startWidth: labelWidth };
    function onMouseMove(ev: MouseEvent) {
      if (!dragState.current) return;
      setLabelWidth(Math.max(40, dragState.current.startWidth + (ev.clientX - dragState.current.startX)));
    }
    function onMouseUp() {
      dragState.current = null;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    }
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }

  function onTouchStart(e: React.TouchEvent) {
    e.preventDefault();
    dragState.current = { startX: e.touches[0].clientX, startWidth: labelWidth };
    function onTouchMove(ev: TouchEvent) {
      if (!dragState.current) return;
      setLabelWidth(Math.max(40, dragState.current.startWidth + (ev.touches[0].clientX - dragState.current.startX)));
    }
    function onTouchEnd() {
      dragState.current = null;
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    }
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd);
  }

  return { labelWidth, onMouseDown, onTouchStart };
}

export default function DistanceMatrix(): JSX.Element {
  const { distanceMatrix, avgDistance, isStale } = useNJStore();
  const allOrder = useSequenceStore((s) => s.order);
  const moveSequence = useSequenceStore((s) => s.moveSequence);
  const { edits } = useEditStore(useShallow((s) => ({ edits: s.edits })));
  const [showNumbers, setShowNumbers] = useState(true);
  const [colorScheme, setColorScheme] = useState<ColorScheme>("warm");
  const { labelWidth, onMouseDown: onDividerMouseDown, onTouchStart: onDividerTouchStart } =
    useLabelDividerResize();
  const labelsRef = useRef<HTMLDivElement>(null);
  const matrixRef = useRef<HTMLDivElement>(null);

  if (!distanceMatrix) return <div />;

  const { names, matrix } = distanceMatrix;

  // Render in sequenceStore.order, filtered to names present in this distance matrix
  const nameSet = new Set(names);
  const orderedNames = allOrder.filter((n) => nameSet.has(n));

  // Lookup from name to original matrix index (for cell value retrieval)
  const nameToIndex = new Map(names.map((n, i) => [n, i]));

  const maxValue = Math.max(...matrix.flatMap((row) => row));

  function cellStyle(rowName: string, colName: string): React.CSSProperties {
    const i = nameToIndex.get(rowName)!;
    const j = nameToIndex.get(colName)!;
    if (i === j) return {};
    const intensity = maxValue > 0 ? matrix[i][j] / maxValue : 0;
    const { r, g, b } = cellBg(intensity, colorScheme);
    return { backgroundColor: `rgb(${r},${g},${b})`, color: contrastColor(r, g, b) };
  }

  function handleMatrixScroll() {
    if (labelsRef.current && matrixRef.current) {
      labelsRef.current.scrollTop = matrixRef.current.scrollTop;
    }
  }

  function exportCSV() {
    const labels = orderedNames.map((n) => resolveDisplayName(n, edits));
    const escape = (s: string) => (/[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
    const header = ["", ...labels].map(escape).join(",");
    const body = orderedNames.map((rowName, i) =>
      [
        escape(labels[i]),
        ...orderedNames.map((colName) =>
          matrix[nameToIndex.get(rowName)!][nameToIndex.get(colName)!].toString(),
        ),
      ].join(","),
    );
    const csv = [header, ...body].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "distances.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col h-full">
      {isStale && (
        <Alert variant="warning" className="rounded-none py-1 px-3 flex-shrink-0">
          <AlertDescription className="text-xs">
            Alignment has been edited — re-run analysis to update distances.
          </AlertDescription>
        </Alert>
      )}
      {/* Toolbar */}
      <div className="flex items-center gap-1 bg-muted rounded-t-md px-1 py-1 flex-shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">View</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-max p-2">
            <DropdownMenuCheckboxItem
              checked={showNumbers}
              onCheckedChange={(c) => setShowNumbers(c)}
            >
              Show numbers
            </DropdownMenuCheckboxItem>
            <DropdownMenuLabel className="text-xs text-muted-foreground pt-2">
              Color scheme
            </DropdownMenuLabel>
            <RadioGroup
              value={colorScheme}
              onValueChange={(v) => setColorScheme(v as ColorScheme)}
              className="gap-1 px-2"
            >
              {COLOR_SCHEMES.map(({ value, label }) => (
                <label
                  key={value}
                  className="flex items-center gap-2 cursor-pointer whitespace-nowrap text-sm"
                >
                  <RadioGroupItem value={value} className="size-3" />
                  {label}
                </label>
              ))}
            </RadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">File</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-max p-1">
            <DropdownMenuItem onSelect={exportCSV}>Export distances (CSV)</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <UndoRedoButtons />
        {avgDistance !== null && (
          <span className="ml-auto pr-1 text-xs font-medium opacity-70">
            Avg distance:{" "}
            <span className="inline-flex items-center rounded-md bg-secondary px-1.5 py-0.5 text-secondary-foreground font-mono">
              {avgDistance.toFixed(4)}
            </span>
          </span>
        )}
        <HelpButton anchor="distances" label="Distances documentation" />
      </div>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left labels panel — overflow:hidden, scrollTop synced by JS with the matrix */}
        <div
          ref={labelsRef}
          className="flex-shrink-0 bg-background"
          style={{ width: labelWidth, overflow: "hidden" }}
        >
          {/* Spacer matching the sticky column header height */}
          <div style={{ height: HEADER_HEIGHT, flexShrink: 0 }} />
          <SequenceLabels
            entries={orderedNames.map((name) => ({ id: name }))}
            rowHeight={CELL_HEIGHT}
            width={labelWidth}
            containerHeight={orderedNames.length * CELL_HEIGHT}
            textAlign="left"
            fontSize={12}
            onReorder={moveSequence}
          />
        </div>

        {/* Draggable divider */}
        <div
          className="group flex-shrink-0 flex justify-center"
          style={{ width: DIVIDER_WIDTH, cursor: "col-resize" }}
          onMouseDown={onDividerMouseDown}
          onTouchStart={onDividerTouchStart}
        >
          <div className="w-px bg-border group-hover:bg-primary transition-colors self-stretch" />
        </div>

        {/* Heatmap panel */}
        <div
          ref={matrixRef}
          className="overflow-auto flex-1"
          onScroll={handleMatrixScroll}
        >
          {/* Sticky column headers */}
          <div
            className="sticky top-0 bg-background z-10 flex"
            style={{ height: HEADER_HEIGHT }}
          >
            {orderedNames.map((name) => {
              const displayName = resolveDisplayName(name, edits);
              return (
                <div
                  key={name}
                  className="flex-shrink-0 relative font-mono text-xs"
                  style={{ width: CELL_WIDTH, height: HEADER_HEIGHT }}
                  title={displayName}
                >
                  <span
                    style={{
                      position: "absolute",
                      bottom: 4,
                      left: CELL_WIDTH / 2,
                      transformOrigin: "bottom left",
                      transform: "rotate(-45deg)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {displayName}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Matrix rows */}
          {orderedNames.map((rowName) => (
            <div key={rowName} className="flex">
              {orderedNames.map((colName) => (
                <div
                  key={colName}
                  className="flex-shrink-0 flex items-center justify-center font-mono tabular-nums text-xs border border-muted"
                  style={{ width: CELL_WIDTH, height: CELL_HEIGHT, ...cellStyle(rowName, colName) }}
                >
                  {rowName === colName ? "—" : showNumbers ? matrix[nameToIndex.get(rowName)!][nameToIndex.get(colName)!].toFixed(3) : ""}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
