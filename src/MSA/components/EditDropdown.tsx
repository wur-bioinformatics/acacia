import type { JSX } from "react";
import { useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useDrawStore } from "../stores/drawStore";
import { useEditStore } from "../../editStore";
import { useQualityStore } from "../stores/qualityStore";
import { useMSAStore } from "../stores/msaStore";
import { applyEdits, currentToOriginalCol } from "../../editUtils";
import { rowMeanTCS } from "../utils/rowQuality";
import { columnGapFractions, rowGapFractions } from "../utils/gapFraction";
import { computeColumnStats } from "../utils/msaAnalysis";
import { computeThresholdSelection } from "../utils/thresholdSelection";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import EditMenuItems from "../../EditMenuItems";

type Thresholds = {
  conservation: number;
  colTrident: number;
  colTcs: number;
  colGap: number;
  rowTcs: number;
  rowGap: number;
};

const ZERO_THRESHOLDS: Thresholds = {
  conservation: 0,
  colTrident: 0,
  colTcs: 0,
  colGap: 0,
  rowTcs: 0,
  rowGap: 0,
};

/** One labelled "select by metric" slider. */
function SelectSlider({
  label,
  value,
  disabled,
  hint,
  onChange,
}: {
  label: string;
  value: number;
  disabled?: boolean;
  hint: string;
  onChange: (v: number) => void;
}): JSX.Element {
  return (
    <div className="px-2 pt-2">
      <span className="text-xs">{label}</span>
      <Slider
        className="pt-1.5"
        min={0}
        max={1}
        step={0.01}
        value={[value]}
        disabled={disabled}
        onValueChange={(v) => onChange(v[0])}
      />
      <p className="pt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

export default function EditDropdown(): JSX.Element {
  const [open, setOpen] = useState(false);
  const [thr, setThr] = useState<Thresholds>(ZERO_THRESHOLDS);

  // The contribution the threshold sliders last added to the selection. Kept in
  // a ref so a recompute can remove the previous threshold-derived rows/columns
  // and add the new ones without disturbing any manually-selected cells.
  const thrContribRef = useRef<{ columns: Set<number>; rows: Set<string> }>({
    columns: new Set(),
    rows: new Set(),
  });

  const selection = useDrawStore((s) => s.selection);
  const clearSelection = useDrawStore((s) => s.clearSelection);
  const setSelection = useDrawStore((s) => s.setSelection);

  const { trident, tcs, tcsColMean, tcsIdentifiers, tridentStale, tcsStale } = useQualityStore(
    useShallow((s) => ({
      trident: s.trident,
      tcs: s.tcs,
      tcsColMean: s.tcsColMean,
      tcsIdentifiers: s.tcsIdentifiers,
      tridentStale: s.tridentStale,
      tcsStale: s.tcsStale,
    })),
  );
  const tridentReady = trident !== null && !tridentStale;
  const tcsColReady = tcsColMean !== null && !tcsStale;
  const tcsRowReady = tcs !== null && tcsIdentifiers !== null && !tcsStale;

  const editedMSA = useMSAStore((s) => s.msaData);
  const originalMSA = useEditStore((s) => s.originalMSA);
  const edits = useEditStore((s) => s.edits);
  const currentMSA = useMemo(
    () => (originalMSA.length > 0 ? applyEdits(originalMSA, edits) : editedMSA),
    [originalMSA, edits, editedMSA],
  );

  const rowMeans = useMemo(() => {
    if (!tcsRowReady) return null;
    return rowMeanTCS(tcs!, currentMSA, tcsIdentifiers!);
  }, [tcs, tcsIdentifiers, currentMSA, tcsRowReady]);

  const colGaps = useMemo(() => columnGapFractions(currentMSA), [currentMSA]);
  const rowGaps = useMemo(() => rowGapFractions(currentMSA), [currentMSA]);
  // Gap-aware per-column conservation (fraction of all rows matching the dominant residue).
  const colConservation = useMemo(
    () => computeColumnStats(currentMSA).map((s) => s.identity),
    [currentMSA],
  );

  // Recompute the threshold-derived selection from the given thresholds and fold
  // it into the persistent selection, replacing the previous threshold
  // contribution while preserving any manually-selected rows/columns.
  function recompute(next: Thresholds) {
    const contrib = computeThresholdSelection({
      conservation: colConservation,
      conservationThreshold: next.conservation,
      trident: tridentReady ? trident : null,
      tridentThreshold: next.colTrident,
      tcsColMean: tcsColReady ? tcsColMean : null,
      tcsColThreshold: next.colTcs,
      colGaps,
      colGapThreshold: next.colGap,
      rowTcsMeans: rowMeans,
      rowTcsThreshold: next.rowTcs,
      rowGaps,
      rowGapThreshold: next.rowGap,
    });

    const prevContrib = thrContribRef.current;
    setSelection((prev) => {
      const columns = new Set<number>();
      for (const c of prev.columns) if (!prevContrib.columns.has(c)) columns.add(c);
      for (const c of contrib.columns) columns.add(c);
      const rows = new Set<string>();
      for (const r of prev.rows) if (!prevContrib.rows.has(r)) rows.add(r);
      for (const r of contrib.rows) rows.add(r);
      return { ...prev, columns, rows };
    });
    thrContribRef.current = contrib;
  }

  function update(patch: Partial<Thresholds>) {
    const next = { ...thr, ...patch };
    setThr(next);
    recompute(next);
  }

  // Per-slider counts so each criterion's effect is visible independently even
  // though the selection overlay paints their union.
  function below(values: Iterable<number>, t: number): number {
    let n = 0;
    for (const v of values) if (v < t) n++;
    return n;
  }
  function above(values: Iterable<number>, t: number): number {
    let n = 0;
    for (const v of values) if (v > t) n++;
    return n;
  }
  const consCount =
    thr.conservation > 0
      ? colConservation.reduce((n, v) => n + (v >= thr.conservation ? 1 : 0), 0)
      : 0;
  const colTridentCount =
    tridentReady && thr.colTrident > 0 ? below(trident!, thr.colTrident) : 0;
  const colTcsCount = tcsColReady && thr.colTcs > 0 ? below(tcsColMean!, thr.colTcs) : 0;
  const colGapCount = thr.colGap > 0 ? above(colGaps, thr.colGap) : 0;
  const rowTcsCount =
    rowMeans && thr.rowTcs > 0 ? below(rowMeans.values(), thr.rowTcs) : 0;
  const rowGapCount = thr.rowGap > 0 ? above(rowGaps.values(), thr.rowGap) : 0;

  const selCount = selection.rows.size + selection.columns.size;
  const nRows = currentMSA.length;
  const nCols = currentMSA[0]?.sequence.length ?? 0;
  // A delete may never empty the alignment: block it when the selection covers
  // every row or every column (the store enforces this too, as a backstop).
  const wouldEmptyMSA =
    selCount > 0 && (selection.rows.size >= nRows || selection.columns.size >= nCols);

  function applySelection(rows: Iterable<string>, cols: Iterable<number>) {
    const editsSnapshot = useEditStore.getState().edits;
    const addEdit = useEditStore.getState().addEdit;
    const sortedCols = [...cols].sort((a, b) => b - a); // descending
    for (const c of sortedCols) {
      addEdit({ type: "remove_column", originalIndex: currentToOriginalCol(c, editsSnapshot) });
    }
    for (const id of rows) {
      addEdit({ type: "remove_row", originalId: id });
    }
  }

  function resetThresholds() {
    setThr(ZERO_THRESHOLDS);
    thrContribRef.current = { columns: new Set(), rows: new Set() };
  }

  function handleClear() {
    clearSelection();
    resetThresholds();
  }

  function handleDelete() {
    if (wouldEmptyMSA) return;
    applySelection(selection.rows, selection.columns);
    clearSelection();
    resetThresholds();
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm">Edit</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[280px] p-2">
        <EditMenuItems />

        <DropdownMenuSeparator />

        <DropdownMenuLabel>Selection</DropdownMenuLabel>
        <p className="px-2 text-xs text-muted-foreground">
          {selection.rows.size} rows · {selection.columns.size} columns selected
        </p>
        <p className="px-2 text-xs text-muted-foreground max-w-64 pt-1">
          Use the sliders below, or Select mode in the toolbar / Shift-drag on the
          alignment, to build a selection. Delete removes it from the alignment.
        </p>
        <div className="flex gap-1 px-2 pt-2">
          <Button
            size="xs"
            variant="outline"
            className="flex-1"
            onClick={handleClear}
            disabled={selCount === 0}
          >
            Clear
          </Button>
          <Button
            size="xs"
            variant="destructive"
            className="flex-1"
            onClick={handleDelete}
            disabled={selCount === 0 || wouldEmptyMSA}
          >
            Delete
          </Button>
        </div>
        {wouldEmptyMSA && (
          <p className="px-2 pt-1 text-xs text-destructive max-w-64">
            That would delete the whole alignment. Keep at least one row and one
            column.
          </p>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuLabel>Select columns</DropdownMenuLabel>
        <SelectSlider
          label="By conservation (keep ≥)"
          value={thr.conservation}
          hint={
            thr.conservation > 0
              ? `${consCount} columns ≥ ${(thr.conservation * 100).toFixed(0)}% conserved`
              : "Select columns at/above a conservation %"
          }
          onChange={(v) => update({ conservation: v })}
        />
        <SelectSlider
          label="By quality (TRIDENT <)"
          value={thr.colTrident}
          disabled={!tridentReady}
          hint={
            tridentReady
              ? `${colTridentCount} columns below ${thr.colTrident.toFixed(2)}`
              : "Compute TRIDENT first"
          }
          onChange={(v) => update({ colTrident: v })}
        />
        <SelectSlider
          label="By consistency (mean TCS <)"
          value={thr.colTcs}
          disabled={!tcsColReady}
          hint={
            tcsColReady
              ? `${colTcsCount} columns below ${thr.colTcs.toFixed(2)}`
              : "Compute TCS first"
          }
          onChange={(v) => update({ colTcs: v })}
        />
        <SelectSlider
          label="By gaps (>)"
          value={thr.colGap}
          hint={
            thr.colGap > 0
              ? `${colGapCount} columns above ${(thr.colGap * 100).toFixed(0)}% gaps`
              : "Select columns above a gap fraction"
          }
          onChange={(v) => update({ colGap: v })}
        />

        <DropdownMenuSeparator className="mt-2" />

        <DropdownMenuLabel>Select rows</DropdownMenuLabel>
        <SelectSlider
          label="By consistency (mean TCS <)"
          value={thr.rowTcs}
          disabled={!tcsRowReady}
          hint={
            tcsRowReady
              ? `${rowTcsCount} rows below ${thr.rowTcs.toFixed(2)}`
              : "Compute TCS first"
          }
          onChange={(v) => update({ rowTcs: v })}
        />
        <SelectSlider
          label="By gaps (>)"
          value={thr.rowGap}
          hint={
            thr.rowGap > 0
              ? `${rowGapCount} rows above ${(thr.rowGap * 100).toFixed(0)}% gaps`
              : "Select rows above a gap fraction"
          }
          onChange={(v) => update({ rowGap: v })}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
