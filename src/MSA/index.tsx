import { useEffect, useMemo, useState, type JSX } from "react";
import { useShallow } from "zustand/react/shallow";
import { Loader2 } from "lucide-react";
import { AcaciaBrand } from "../AcaciaLogo";
import { useSequenceStore } from "../sequenceStore";

import "./styles.css";

import { importFastaFile } from "./utils/importMSA";
import {
  CELL_SIZE,
  MINIMAP_HEIGHT,
  SCALEBAR_HEIGHT,
  TRACK_LABELS,
} from "./constants";
import { computeColumnStats } from "./utils/msaAnalysis";

import type { MSAData } from "./types";
import { useDrawStore } from "./stores/drawStore";
import { useMSAStore } from "./stores/msaStore";
import usePanZoom from "./hooks/usePanZoom";
import useCanvasRefs from "./hooks/useCanvasRefs";
import useMainCanvasWorker from "./hooks/useMainCanvasWorker";
import useOverlay from "./hooks/useOverlay";
import useSelectionInteractions from "./hooks/useSelectionInteractions";
import useLabelDividerResize from "./hooks/useLabelDividerResize";
import useRowDividerResize from "./hooks/useRowDividerResize";
import { useNJStore } from "../NJ/stores/njStore";
import { useContainerWidth } from "../hooks/useContainerWidth";
import { analyseMSAColumns } from "./utils/msaAnalysis";
import { useEditStore } from "../editStore";
import { applyEdits } from "../editUtils";
import useEditKeyboard from "./hooks/useEditKeyboard";

import { exampleMsa, exampleFoxp2Msa } from "./example_data";
import MSAToolbar from "./components/MSAToolbar";
import MSALabels from "./components/MSALabels";
import TrackCanvas from "./components/TrackCanvas";
import Scalebar from "./components/Scalebar";
import CursorTooltip from "./components/CursorTooltip";
import CursorPositionBadge from "./components/CursorPositionBadge";
import { useQualityStore } from "./stores/qualityStore";
import { CanvasProvider } from "./context/CanvasContext";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

function MSACanvas({
  isMinimap = false,
  height: heightProp,
  width,
  msaData,
}: {
  isMinimap?: boolean;
  height?: number;
  width: number;
  msaData: MSAData;
}): JSX.Element {
  const { canvasRef, overlayRef } = useCanvasRefs({ isMinimap });
  const showConsensus = useDrawStore((s) => s.drawOptions.showConsensus);

  const nCols = msaData[0].sequence.length;
  const nDataRows = msaData.length + (showConsensus ? 1 : 0);
  const mainHeight = isMinimap
    ? (heightProp ?? MINIMAP_HEIGHT)
    : nDataRows * CELL_SIZE;

  const { isRendering, firstPaintPending } = useMainCanvasWorker({
    canvasRef,
    msaData,
    isMinimap,
    canvasWidth: width,
    canvasHeight: mainHeight,
  });

  const orderedIdentifiers = useMemo(
    () => msaData.map((s) => s.identifier),
    [msaData],
  );

  useOverlay({
    isMinimap,
    overlayRef,
    width,
    height: mainHeight,
    nCols,
    orderedIdentifiers,
  });

  return (
    <div
      className="msa"
      style={{
        position: "relative",
        width: width,
        height: mainHeight,
      }}
    >
      <canvas
        className="main-msa-canvas"
        ref={canvasRef}
        width={width}
        height={mainHeight}
        style={{ position: "absolute", top: 0, left: 0, zIndex: 1 }}
      />
      <canvas
        className="overlay-canvas"
        ref={overlayRef}
        width={width}
        height={mainHeight}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          zIndex: 2,
          pointerEvents: "auto",
          touchAction: "none",
        }}
      />
      {!isMinimap && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 3,
            pointerEvents: "none",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            paddingTop: 80,
            backgroundColor: "var(--color-background)",
            // Fully cover the blank canvas with a spinner on first paint; once the
            // alignment is drawn, dim only briefly while re-rendering (pan/zoom).
            opacity: firstPaintPending ? 1 : isRendering ? 0.4 : 0,
            transition: "opacity 0.15s ease 0.15s",
          }}
        >
          {firstPaintPending && (
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Rendering alignment…
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function MSAInput() {
  const { setMSAData } = useMSAStore();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // In-memory example alignments are trusted in-repo data, so they bypass the
  // file read/validation pipeline and load directly.
  async function loadExample(label: string, msa: MSAData) {
    setError(null);
    setLoading(label);
    // Yield a frame so the spinner paints before the (synchronous) setMSAData
    // runs on the main thread. On success this component unmounts.
    await new Promise(requestAnimationFrame);
    setMSAData(msa);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset so re-selecting the same file fires onChange again.
    e.target.value = "";
    if (!file) return;
    setError(null);
    setLoading(file.name);
    // importFastaFile awaits the file read, giving the spinner a chance to paint
    // before the (synchronous) setMSAData on success.
    const result = await importFastaFile(file);
    if (!result.ok) {
      setLoading(null);
      setError(result.error);
      return;
    }
    setMSAData(result.msa);
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-16">
        <AcaciaBrand size={56} className="opacity-80 mb-2" />
        <Loader2 className="size-6 animate-spin opacity-50" />
        <span className="text-sm opacity-50">Loading {loading}…</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 py-16">
      <AcaciaBrand size={56} className="opacity-80 mb-2" />
      <p className="text-sm opacity-40 mb-2">
        Explore multiple sequence alignments and phylogenetic trees in a web
        browser.
      </p>
      <label className="flex flex-col items-center gap-2 px-12 py-10 border-2 border-dashed border rounded-2xl cursor-pointer hover:border-primary transition-colors group">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="opacity-25 group-hover:opacity-50 transition-opacity"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <span className="text-sm font-medium">Upload FASTA file</span>
        <span className="text-xs font-medium opacity-40">
          <i>Must be aligned!</i>
        </span>
        <span className="text-xs opacity-40">click to browse</span>
        <input
          type="file"
          className="hidden"
          accept=".fasta,.fa,.fna,.faa,.txt"
          onChange={handleFileChange}
        />
      </label>
      <span className="text-xs opacity-25">or</span>
      <div className="flex gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="opacity-50 hover:opacity-100"
          onClick={() => loadExample("PLT1 example", exampleMsa)}
        >
          load PLT1 example
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="opacity-50 hover:opacity-100"
          onClick={() => loadExample("FOXP2 example", exampleFoxp2Msa)}
        >
          load FOXP2 example
        </Button>
      </div>
      {error && (
        <Alert variant="destructive" className="mt-2 max-w-md">
          <AlertDescription className="text-xs">{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function MSAInner(): JSX.Element {
  const { originalMSA, edits } = useEditStore(
    useShallow((s) => ({ originalMSA: s.originalMSA, edits: s.edits })),
  );
  const { order } = useSequenceStore();
  const { status: njStatus, progress, distanceStatus } = useNJStore();
  const {
    tridentStatus,
    tcsStatus,
    tcsProgress,
    tridentError,
    tcsError,
    tridentStale,
    tcsStale,
  } = useQualityStore(
    useShallow((s) => ({
      tridentStatus: s.tridentStatus,
      tcsStatus: s.tcsStatus,
      tcsProgress: s.tcsProgress,
      tridentError: s.tridentError,
      tcsError: s.tcsError,
      tridentStale: s.tridentStale,
      tcsStale: s.tcsStale,
    })),
  );
  const {
    drawOptions: {
      showLabels,
      showConsensus,
      showMinimap,
      offsetY,
      colorStyle,
    },
    activeTrack,
    setDrawOptions,
    setActiveTrack,
  } = useDrawStore();

  useEditKeyboard();

  // Column selection is keyed by current display index. When edits change
  // (apply, undo, redo) those indices may now reference different residues —
  // clear the column selection. Row identifiers remain valid across edits.
  useEffect(() => {
    const { selection, setSelection } = useDrawStore.getState();
    if (selection.columns.size > 0 || selection.lastCol !== null) {
      setSelection((prev) => ({
        ...prev,
        columns: new Set(),
        lastCol: null,
      }));
    }
  }, [edits.length]);

  const editedMSA = useMemo(
    () => applyEdits(originalMSA, edits),
    [originalMSA, edits],
  );

  const orderedMsaData = useMemo<MSAData>(() => {
    if (order.length === 0) return editedMSA;
    const byId = new Map(editedMSA.map((s) => [s.identifier, s]));
    return order
      .map((id) => byId.get(id))
      .filter((s) => s !== undefined) as MSAData;
  }, [order, editedMSA]);

  const nRows = orderedMsaData.length;
  const nCols = orderedMsaData[0]?.sequence.length ?? 0;

  // These two passes are O(sequences × length). Only compute them when something
  // actually consumes the result: the track panel (both) or the site-classification
  // color styles in the status bar (analysis). The default load — residue coloring,
  // no track — does neither on the main thread. The canvas worker computes its own
  // copies for rendering.
  const needsAnalysis =
    activeTrack !== null ||
    colorStyle === "Parsimony Informative" ||
    colorStyle === "Conserved" ||
    colorStyle === "Variable";

  const analysis = useMemo(
    () =>
      needsAnalysis && orderedMsaData.length > 0
        ? analyseMSAColumns(orderedMsaData)
        : null,
    [needsAnalysis, orderedMsaData],
  );

  const columnStats = useMemo(
    () =>
      activeTrack !== null && orderedMsaData.length > 0
        ? computeColumnStats(orderedMsaData)
        : [],
    [activeTrack, orderedMsaData],
  );

  function handleTrackClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const { offsetX, scale } = useDrawStore.getState().drawOptions;
    const x = e.clientX - rect.left;
    const col = Math.floor((x - offsetX) / (CELL_SIZE * scale));
    if (col < 0 || col >= nCols) return;

    const { setSelection } = useDrawStore.getState();
    if (e.shiftKey) {
      setSelection((prev) => {
        const lo = prev.lastCol === null ? col : Math.min(prev.lastCol, col);
        const hi = prev.lastCol === null ? col : Math.max(prev.lastCol, col);
        const next = new Set(prev.columns);
        for (let i = lo; i <= hi; i++) next.add(i);
        return { ...prev, columns: next, lastCol: col };
      });
    } else if (e.metaKey || e.ctrlKey) {
      setSelection((prev) => {
        const next = new Set(prev.columns);
        if (next.has(col)) next.delete(col);
        else next.add(col);
        return { ...prev, columns: next, lastCol: col };
      });
    } else {
      setSelection((prev) => ({
        ...prev,
        columns: new Set([col]),
        lastCol: col,
      }));
    }
  }

  usePanZoom({ nRows, nCols });
  useSelectionInteractions({ orderedMsaData, nCols });

  const {
    labelWidth,
    onMouseDown: onDividerMouseDown,
    onTouchStart: onDividerTouchStart,
  } = useLabelDividerResize();

  const {
    height: minimapHeight,
    onMouseDown: onMinimapDivMouseDown,
    onTouchStart: onMinimapDivTouchStart,
  } = useRowDividerResize(MINIMAP_HEIGHT, 20);

  const {
    height: trackHeight,
    onMouseDown: onTrackDivMouseDown,
    onTouchStart: onTrackDivTouchStart,
  } = useRowDividerResize(80, 30);

  const DIVIDER_WIDTH = 8;
  const effectiveLabelWidth = showLabels ? labelWidth : 0;
  const effectiveDividerWidth = showLabels ? DIVIDER_WIDTH : 0;

  const [containerRef, containerWidth] = useContainerWidth(labelWidth + 300);
  const canvasWidth = Math.max(
    300,
    containerWidth - effectiveLabelWidth - effectiveDividerWidth,
  );

  return (
    <div ref={containerRef}>
      {!nRows && <MSAInput />}
      {!!nRows && containerWidth > 0 && (
        <div className="flex flex-col">
          <MSAToolbar />

          {/* Minimap */}
          {showMinimap && (
            <>
              <div className="flex" style={{ marginTop: 4 }}>
                <div
                  style={{
                    width: effectiveLabelWidth + effectiveDividerWidth,
                    height: minimapHeight,
                    flexShrink: 0,
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    paddingRight: effectiveDividerWidth + 8,
                  }}
                >
                  {showLabels && (
                    <>
                      <button
                        onClick={() => setDrawOptions({ showMinimap: false })}
                        title="Hide minimap"
                        style={{ position: "absolute", top: 2, left: 2 }}
                        className="opacity-20 hover:opacity-70 transition-opacity"
                      >
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 10 10"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        >
                          <line x1="1" y1="1" x2="9" y2="9" />
                          <line x1="9" y1="1" x2="1" y2="9" />
                        </svg>
                      </button>
                      <span
                        style={{
                          fontSize: 10,
                          fontFamily: '"Azeret Mono", ui-monospace, monospace',
                          opacity: 0.3,
                          letterSpacing: "0.02em",
                        }}
                      >
                        Minimap
                      </span>
                    </>
                  )}
                </div>
                <MSACanvas
                  isMinimap
                  height={minimapHeight}
                  width={canvasWidth}
                  msaData={orderedMsaData}
                />
              </div>

              {/* Divider 1: bottom edge of minimap */}
              <div
                className="group"
                onMouseDown={onMinimapDivMouseDown}
                onTouchStart={onMinimapDivTouchStart}
                style={{
                  cursor: "row-resize",
                  height: 6,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <div className="h-px w-full bg-accent group-hover:bg-primary transition-colors" />
              </div>
            </>
          )}

          {/* Track panel */}
          {activeTrack && (
            <div className="flex">
              <div
                style={{
                  width: effectiveLabelWidth + effectiveDividerWidth,
                  height: trackHeight,
                  flexShrink: 0,
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  paddingRight: effectiveDividerWidth + 8,
                }}
              >
                {showLabels && (
                  <>
                    <button
                      onClick={() => setActiveTrack(null)}
                      title="Hide track"
                      style={{ position: "absolute", top: 2, left: 2 }}
                      className="opacity-20 hover:opacity-70 transition-opacity"
                    >
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 10 10"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      >
                        <line x1="1" y1="1" x2="9" y2="9" />
                        <line x1="9" y1="1" x2="1" y2="9" />
                      </svg>
                    </button>
                    <span
                      style={{
                        fontSize: 10,
                        fontFamily: '"Azeret Mono", ui-monospace, monospace',
                        opacity: 0.3,
                        letterSpacing: "0.02em",
                      }}
                    >
                      {TRACK_LABELS[activeTrack]}
                    </span>
                  </>
                )}
              </div>
              <TrackCanvas
                width={canvasWidth}
                height={trackHeight}
                trackType={activeTrack}
                columnStats={columnStats}
                analysis={
                  analysis ?? {
                    parsimonyInformativeSites: [],
                    conservedSites: [],
                    variableSites: [],
                  }
                }
                onClick={handleTrackClick}
              />
            </div>
          )}

          {/* Divider 2: bottom edge of track */}
          {activeTrack && (
            <div
              className="group"
              onMouseDown={onTrackDivMouseDown}
              onTouchStart={onTrackDivTouchStart}
              style={{
                cursor: "row-resize",
                height: 6,
                display: "flex",
                alignItems: "center",
              }}
            >
              <div className="h-px w-full bg-accent group-hover:bg-primary transition-colors" />
            </div>
          )}

          {/* Scalebar: column ruler, aligned with the main canvas below it */}
          <div className="flex">
            <div
              style={{
                width: effectiveLabelWidth + effectiveDividerWidth,
                height: SCALEBAR_HEIGHT,
                flexShrink: 0,
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "flex-end",
                paddingRight: effectiveDividerWidth + 8,
              }}
            >
              {showLabels && (
                <span
                  style={{
                    fontSize: 10,
                    fontFamily: '"Azeret Mono", ui-monospace, monospace',
                    opacity: 0.3,
                    letterSpacing: "0.02em",
                    lineHeight: 1.6,
                  }}
                >
                  Position
                </span>
              )}
            </div>
            <Scalebar width={canvasWidth} nCols={nCols} />
          </div>

          {/* Main canvas with labels */}
          <div className="flex">
            {showLabels && (
              <MSALabels
                msaData={orderedMsaData}
                showConsensus={showConsensus}
                offsetY={offsetY}
                width={labelWidth}
              />
            )}
            {showLabels && (
              <div
                className="group"
                onMouseDown={onDividerMouseDown}
                onTouchStart={onDividerTouchStart}
                style={{
                  width: DIVIDER_WIDTH,
                  flexShrink: 0,
                  cursor: "col-resize",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div className="w-px h-full bg-accent group-hover:bg-primary transition-colors" />
              </div>
            )}
            <MSACanvas width={canvasWidth} msaData={orderedMsaData} />
          </div>

          {/* Status bar */}
          <div className="flex items-center gap-4 border-t border-muted mt-2 pt-1 text-xs font-mono opacity-35">
            <span>
              {nRows} sequences · {nCols} sites
            </span>
            {analysis && colorStyle === "Parsimony Informative" && (
              <span>
                {analysis.parsimonyInformativeSites.length} parsimony
                informative
              </span>
            )}
            {analysis && colorStyle === "Conserved" && (
              <span>{analysis.conservedSites.length} conserved</span>
            )}
            {analysis && colorStyle === "Variable" && (
              <span>{analysis.variableSites.length} variable</span>
            )}
            <div className="ml-auto flex items-center gap-4">
              {njStatus === "running" && progress && (
                <span>
                  building tree · bootstrap {progress.current} /{" "}
                  {progress.total}
                </span>
              )}
              {distanceStatus === "running" && (
                <span>computing distances…</span>
              )}
              {njStatus === "error" && (
                <span className="font-sans text-destructive opacity-100">
                  tree build failed
                </span>
              )}
              {tcsStatus === "running" && (
                <span>
                  computing TCS
                  {tcsProgress
                    ? ` · ${tcsProgress.stage} ${tcsProgress.current} / ${tcsProgress.total}`
                    : "…"}
                </span>
              )}
              {tcsStatus !== "running" && tridentStatus === "running" && (
                <span>computing TRIDENT…</span>
              )}
              {(tridentStale || tcsStale) && (
                <span className="font-sans opacity-100">
                  {[tridentStale && "TRIDENT", tcsStale && "TCS"]
                    .filter(Boolean)
                    .join(" + ")}{" "}
                  stale — recompute
                </span>
              )}
              {(tridentStatus === "error" || tcsStatus === "error") && (
                <span className="font-sans text-destructive opacity-100">
                  quality failed
                  {(tridentError ?? tcsError)
                    ? ` · ${tridentError ?? tcsError}`
                    : ""}
                </span>
              )}
              <CursorPositionBadge />
            </div>
          </div>
        </div>
      )}
      <CursorTooltip />
    </div>
  );
}

export default function MSA(): JSX.Element {
  return (
    <CanvasProvider>
      <MSAInner />
    </CanvasProvider>
  );
}
