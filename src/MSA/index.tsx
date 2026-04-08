import type { JSX } from "react";
import { useState, useRef } from "react";
import { exampleMsa } from "./example_data";

import "./styles.css";

import { parseFasta, readTextFile } from "./utils/fasta";
import { LABEL_WIDTH, CELL_SIZE, MINIMAP_HEIGHT } from "./constants";

import { useDrawStore } from "./stores/drawStore";
import { useMSAStore } from "./stores/msaStore";
import usePanZoom from "./hooks/usePanZoom";
import useCanvasRefs from "./hooks/useCanvasRefs";
import useMainCanvasWorker from "./hooks/useMainCanvasWorker";
import useOverlay from "./hooks/useOverlay";
import { useNJWorker, useNJStore } from "../NJ";
import { useViewStore } from "../viewStore";
import { useContainerWidth } from "../hooks/useContainerWidth";
import type { NJConfig } from "@holmrenser/nj";

import MSAToolbar from "./components/MSAToolbar";
import MSALabels from "./components/MSALabels";
import { CanvasProvider } from "./context/CanvasContext";

function MSACanvas({
  isMinimap = false,
  width,
}: {
  isMinimap?: boolean;
  width: number;
}): JSX.Element {
  const { msaData } = useMSAStore();
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
  const { runNJ } = useNJWorker();
  const {
    status: njStatus,
    progress,
    setRunning,
    setResult,
    setError,
    setProgress,
  } = useNJStore();
  const { setView } = useViewStore();
  const nRows = msaData.length;
  const nCols = msaData[0]?.sequence.length ?? 0;
  const {
    drawOptions: {
      showLetters,
      showConsensus,
      colorStyle: currentColorStyle,
      offsetY,
      isConservation,
    },
    setDrawOptions,
  } = useDrawStore();
  usePanZoom({ nRows, nCols });

  const [labelWidth, setLabelWidth] = useState(LABEL_WIDTH);
  const DIVIDER_WIDTH = 8;
  const dragState = useRef<{ startX: number; startWidth: number } | null>(null);

  function handleDividerMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    dragState.current = { startX: e.clientX, startWidth: labelWidth };
    function onMouseMove(ev: MouseEvent) {
      if (!dragState.current) return;
      const delta = ev.clientX - dragState.current.startX;
      setLabelWidth(Math.max(50, dragState.current.startWidth + delta));
    }
    function onMouseUp() {
      dragState.current = null;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    }
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }

  const [containerRef, containerWidth] = useContainerWidth(LABEL_WIDTH + 300);
  const canvasWidth = Math.max(300, containerWidth - labelWidth - DIVIDER_WIDTH);

  function handleRunNJ() {
    setRunning();
    const njConfig: NJConfig = {
      msa: msaData,
      n_bootstrap_samples: 100,
      substitution_model: "PDiff",
    };
    runNJ({
      njConfig,
      onProgress: (current, total) => setProgress(current, total),
    })
      .then((newick) => {
        setResult(newick);
        setView("Tree");
      })
      .catch((err: Error) => setError(err.message));
  }

  return (
    <div ref={containerRef}>
      {!nRows && <MSAInput />}
      {!!nRows && containerWidth > 0 && (
        <div className="flex flex-col">
          <MSAToolbar
            showLetters={showLetters}
            showConsensus={showConsensus}
            isConservation={isConservation}
            currentColorStyle={currentColorStyle}
            njStatus={njStatus}
            onToggleLetters={() => setDrawOptions({ showLetters: !showLetters })}
            onToggleConsensus={() => setDrawOptions({ showConsensus: !showConsensus })}
            onToggleConservation={() => setDrawOptions({ isConservation: !isConservation })}
            onColorStyleChange={(colorStyle) => setDrawOptions({ colorStyle })}
            onRunNJ={handleRunNJ}
          />

          {/* Minimap / conservation track */}
          <div className="flex" style={{ marginBottom: 4 }}>
            <div style={{ width: labelWidth + DIVIDER_WIDTH, flexShrink: 0 }} />
            <MSACanvas isMinimap width={canvasWidth} />
          </div>

          {/* Main canvas with labels */}
          <div className="flex">
            <MSALabels
              msaData={msaData}
              showConsensus={showConsensus}
              offsetY={offsetY}
              width={labelWidth}
            />
            <div
              className="group"
              onMouseDown={handleDividerMouseDown}
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
            <MSACanvas width={canvasWidth} />
          </div>

          {/* Status bar */}
          <div className="flex items-center gap-4 border-t border-base-200 mt-2 pt-1 text-xs font-mono opacity-35">
            <span>
              {nRows} sequences · {nCols} sites
            </span>
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
