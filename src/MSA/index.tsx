import { useMemo, type JSX } from "react";
import { useSequenceStore } from "../sequenceStore";

import "./styles.css";

import { parseFasta, readTextFile } from "./utils/fasta";
import { CELL_SIZE, MINIMAP_HEIGHT } from "./constants";

import type { MSAData } from "./types";
import { useDrawStore } from "./stores/drawStore";
import { useMSAStore } from "./stores/msaStore";
import usePanZoom from "./hooks/usePanZoom";
import useCanvasRefs from "./hooks/useCanvasRefs";
import useMainCanvasWorker from "./hooks/useMainCanvasWorker";
import useOverlay from "./hooks/useOverlay";
import useLabelDividerResize from "./hooks/useLabelDividerResize";
import { useNJStore } from "../NJ/njStore";
import { useContainerWidth } from "../hooks/useContainerWidth";
import { analyseMSAColumns } from "./utils/msaAnalysis";

import { exampleMsa } from "./example_data";
import MSAToolbar from "./components/MSAToolbar";
import MSALabels from "./components/MSALabels";
import { CanvasProvider } from "./context/CanvasContext";

function MSACanvas({
  isMinimap = false,
  width,
  msaData,
}: {
  isMinimap?: boolean;
  width: number;
  msaData: MSAData;
}): JSX.Element {
  const { drawOptions } = useDrawStore();
  const { canvasRef, overlayRef } = useCanvasRefs({ isMinimap });
  const { showConsensus } = drawOptions;

  const nCols = msaData[0].sequence.length;
  const nDataRows = msaData.length + (showConsensus ? 1 : 0);
  const mainHeight = isMinimap ? MINIMAP_HEIGHT : nDataRows * CELL_SIZE;

  useMainCanvasWorker({
    canvasRef,
    msaData,
    drawOptions,
    isMinimap,
    canvasWidth: width,
    canvasHeight: mainHeight,
  });

  useOverlay({ isMinimap, overlayRef, width, height: mainHeight, nCols });

  return (
    <div
      className="msa"
      style={{
        position: "relative",
        width: width,
        height: mainHeight,
        paddingBottom: isMinimap ? 10 : 0,
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
    </div>
  );
}

function MSAInput() {
  const { setMSAData } = useMSAStore();
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await readTextFile(file);
      setMSAData(parseFasta(text));
    } catch (error) {
      console.error("Failed to read file:", error);
    }
  }
  return (
    <div className="flex flex-col items-center gap-3 py-16">
      <label className="flex flex-col items-center gap-2 px-12 py-10 border-2 border-dashed border-base-300 rounded-2xl cursor-pointer hover:border-primary transition-colors group">
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
        <span className="text-xs opacity-40">click to browse</span>
        <input
          type="file"
          className="hidden"
          accept=".fasta,.fa,.fna,.faa,.txt"
          onChange={handleFileChange}
        />
      </label>
      <span className="text-xs opacity-25">or</span>
      <button
        className="btn btn-ghost btn-sm opacity-50 hover:opacity-100"
        onClick={() => setMSAData(exampleMsa)}
      >
        load example data
      </button>
    </div>
  );
}

function MSAInner(): JSX.Element {
  const { msaData } = useMSAStore();
  const { order } = useSequenceStore();
  const { status: njStatus, progress } = useNJStore();
  const { drawOptions: { showLabels, showConsensus, offsetY, colorStyle } } = useDrawStore();

  const orderedMsaData = useMemo<MSAData>(() => {
    if (order.length === 0) return msaData;
    const byId = new Map(msaData.map((s) => [s.identifier, s]));
    return order.map((id) => byId.get(id)).filter((s) => s !== undefined) as MSAData;
  }, [order, msaData]);

  const nRows = orderedMsaData.length;
  const nCols = orderedMsaData[0]?.sequence.length ?? 0;
  const analysis = useMemo(() => orderedMsaData.length > 0 ? analyseMSAColumns(orderedMsaData) : null, [orderedMsaData]);

  usePanZoom({ nRows, nCols });

  const { labelWidth, onMouseDown: onDividerMouseDown, onTouchStart: onDividerTouchStart } =
    useLabelDividerResize();

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

          {/* Minimap / conservation track */}
          <div className="flex" style={{ marginBottom: 4, marginTop: 4 }}>
            <div
              style={{
                width: effectiveLabelWidth + effectiveDividerWidth,
                flexShrink: 0,
              }}
            />
            <MSACanvas isMinimap width={canvasWidth} msaData={orderedMsaData} />
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
                <div className="w-px h-full bg-base-300 group-hover:bg-primary transition-colors" />
              </div>
            )}
            <MSACanvas width={canvasWidth} msaData={orderedMsaData} />
          </div>

          {/* Status bar */}
          <div className="flex items-center gap-4 border-t border-base-200 mt-2 pt-1 text-xs font-mono opacity-35">
            <span>
              {nRows} sequences · {nCols} sites
            </span>
            {analysis && colorStyle === "Parsimony Informative" && (
              <span>{analysis.parsimonyInformativeSites.length} parsimony informative</span>
            )}
            {analysis && colorStyle === "Conserved" && (
              <span>{analysis.conservedSites.length} conserved</span>
            )}
            {analysis && colorStyle === "Variable" && (
              <span>{analysis.variableSites.length} variable</span>
            )}
            {njStatus === "running" && progress && (
              <span className="ml-auto">
                building tree · bootstrap {progress.current} / {progress.total}
              </span>
            )}
            {njStatus === "error" && (
              <span className="ml-auto font-sans text-error opacity-100">
                tree build failed
              </span>
            )}
          </div>
        </div>
      )}
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
