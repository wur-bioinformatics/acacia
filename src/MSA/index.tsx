import { useEffect, useRef } from "react";
import type { JSX } from "react";
import { exampleMsa } from "./example_data";

import "./styles.css";

import type { MSAData, SeqObject } from "./types";
import { COLOR_SCHEME_GROUPS } from "./types";

import { useDrawStore } from "./stores/drawStore";
import { useMSAStore } from "./stores/msaStore";
import usePanZoom from "./hooks/usePanZoom";
import useCanvasRefs from "./hooks/useCanvasRefs";
import useMainCanvasWorker from "./hooks/useMainCanvasWorker";
import { useNJWorker, useNJStore } from "../NJ";
import { useViewStore } from "../viewStore";
import { useContainerWidth } from "../hooks/useContainerWidth";
import type { NJConfig } from "@holmrenser/nj";

/**
 * Reads the contents of a File object as text.
 *
 * Asynchronously reads the provided File using a FileReader and returns a Promise that resolves
 * with the file contents as a string. If reading fails, the Promise is rejected with the
 * underlying FileReader error (typically a DOMException).
 *
 * @param file - The File to read. Must be a browser File/Blob object (e.g. from an <input type="file">).
 * @returns A Promise that resolves to the file contents as a string.
 */
async function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      resolve(reader.result as string);
    };

    reader.onerror = () => {
      reject(reader.error);
    };

    reader.readAsText(file);
  });
}

/**
 * Parse a FASTA-formatted string into an MSAData (array of SeqObject).
 *
 * Each FASTA record must start with a header line beginning with '>' followed
 * by one or more sequence lines. The header is taken as the trimmed text after
 * the leading '>' character. Sequence lines are trimmed of surrounding whitespace
 * and concatenated together to form the full sequence for that record. Blank
 * lines are ignored. Lines that appear before the first header ('>') are also
 * ignored.
 *
 * @param input - The FASTA content to parse. Supports both LF and CRLF line endings.
 * @returns An MSAData array (SeqObject[]). Each SeqObject has the shape:
 *          { header: string; sequence: string }. If the input contains no valid
 *          records, an empty array is returned.
 *
 * @remarks
 * - This function preserves the order of records as they appear in the input.
 * - Sequence characters are not validated (non-ACGT characters, gaps, or other
 *   symbols are preserved as-is).
 * - The function does not enforce equal sequence lengths or perform multiple
 *   sequence alignment checks; it only groups headers with their concatenated
 *   sequence lines.
 *
 * @example
 * const fasta = ">seq1\nACGT\n>seq2\nA--T\n";
 * // parseFasta(fasta) => [
 * //   { header: "seq1", sequence: "ACGT" },
 * //   { header: "seq2", sequence: "A--T" }
 * // ]
 *
 * @public
 */
function parseFasta(input: string): MSAData {
  const msa: MSAData = [];
  let currentRecord: SeqObject | null = null;
  input.split(/\r?\n/).forEach((line) => {
    if (line.startsWith(">")) {
      if (currentRecord) {
        msa.push(currentRecord);
      }
      const header = line.substring(1).trim();
      currentRecord = {
        identifier: header,
        sequence: "",
      };
    } else if (currentRecord && line.trim()) {
      currentRecord.sequence += line.trim();
    }
  });
  if (currentRecord) {
    msa.push(currentRecord);
  }
  return msa;
}

function MSACanvas({
  isMinimap = false,
  width,
}: {
  isMinimap?: boolean;
  width: number;
}): JSX.Element {
  const { msaData } = useMSAStore();
  const { drawOptions, setDrawOptions } = useDrawStore();
  const { canvasRef, overlayRef } = useCanvasRefs({ isMinimap });
  const { offsetX, offsetY, scale, showConsensus } = drawOptions;

  const cellSize = 16;
  const nCols = msaData[0].sequence.length;
  const nDataRows = msaData.length + (showConsensus ? 1 : 0);
  const mainHeight = isMinimap ? 50 : nDataRows * 16;

  useMainCanvasWorker({
    canvasRef,
    msaData,
    drawOptions,
    isMinimap,
    canvasWidth: width,
    canvasHeight: mainHeight,
  });

  const drawOptionsRef = useRef(drawOptions);
  drawOptionsRef.current = drawOptions;

  useEffect(() => {
    // Effect to handle overlay mousemove for highlighting
    const overlayCanvas = overlayRef.current;
    if (!overlayCanvas || isMinimap) return;
    const ctx = overlayRef.current?.getContext("2d");
    if (!ctx) return;
    const handleMouseMove = (e: MouseEvent) => {
      const x = e.offsetX;
      const y = e.offsetY;
      const col = Math.floor((x - offsetX) / (cellSize * scale));
      const row = Math.floor((y - offsetY) / cellSize);

      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.strokeStyle = "rgba(48,92,222,0.6)";
      ctx.lineWidth = 1;
      ctx.fillStyle = "rgba(48,92,222,0.3)";
      ctx.strokeRect(0, row * cellSize + offsetY, width, cellSize);
      ctx.fillRect(0, row * cellSize + offsetY, width, cellSize);
      ctx.fillRect(
        col * cellSize * scale + offsetX,
        0,
        cellSize * scale,
        mainHeight,
      );
      ctx.strokeRect(
        col * cellSize * scale + offsetX,
        0,
        cellSize * scale,
        mainHeight,
      );
    };

    overlayCanvas.addEventListener("mousemove", handleMouseMove);

    return () => {
      overlayCanvas.removeEventListener("mousemove", handleMouseMove);
    };
  }, [scale, offsetX, offsetY, isMinimap, overlayRef, mainHeight, width]);

  useEffect(() => {
    // Effect to draw viewport box on minimap
    const overlayCanvas = overlayRef.current;
    if (!overlayCanvas || !isMinimap) return;

    const ctx = overlayRef.current?.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    const scaleX = ctx.canvas.width / (nCols * cellSize);

    const invScale = 1 / scale;

    const boxX = -offsetX * invScale;
    const boxY = -offsetY;
    const boxW = ctx.canvas.width * invScale;
    const boxH = ctx.canvas.height;

    ctx.save();
    ctx.scale(scaleX, 1);
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = "grey";
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = "darkblue";
    ctx.lineWidth = 6;
    ctx.strokeRect(boxX, boxY, boxW, boxH);
    ctx.restore();
  });

  useEffect(() => {
    if (!isMinimap) return;
    const overlayCanvas = overlayRef.current;
    if (!overlayCanvas) return;

    const W = width;
    const scaleX = W / (nCols * cellSize);
    const EDGE = 8;

    const getBox = () => {
      const { offsetX, scale } = drawOptionsRef.current;
      const boxLeft = (-offsetX / scale) * scaleX;
      const boxW = (W / scale) * scaleX;
      return { boxLeft, boxW, boxRight: boxLeft + boxW };
    };

    const clampScale = (s: number) => Math.max(scaleX, Math.min(1, s));
    const clampOffsetX = (ox: number, s: number) => {
      const minOX = Math.min(0, W - nCols * cellSize * s);
      return Math.min(0, Math.max(minOX, ox));
    };

    type DragState = {
      mode: "pan" | "resize-left" | "resize-right";
      startClientX: number;
      startOffsetX: number;
      startScale: number;
      startBoxLeft: number;
      startBoxW: number;
    };
    let drag: DragState | null = null;

    const onMouseDown = (e: MouseEvent) => {
      const mx = e.offsetX;
      const { boxLeft, boxW, boxRight } = getBox();
      if (mx < boxLeft - EDGE || mx > boxRight + EDGE) return;
      const { offsetX, scale } = drawOptionsRef.current;
      let mode: DragState["mode"];
      if (Math.abs(mx - boxLeft) <= EDGE) mode = "resize-left";
      else if (Math.abs(mx - boxRight) <= EDGE) mode = "resize-right";
      else mode = "pan";
      drag = {
        mode,
        startClientX: e.clientX,
        startOffsetX: offsetX,
        startScale: scale,
        startBoxLeft: boxLeft,
        startBoxW: boxW,
      };
    };

    const onCanvasMouseMove = (e: MouseEvent) => {
      if (drag) return;
      const mx = e.offsetX;
      const { boxLeft, boxRight } = getBox();
      if (Math.abs(mx - boxLeft) <= EDGE || Math.abs(mx - boxRight) <= EDGE) {
        overlayCanvas.style.cursor = "ew-resize";
      } else if (mx >= boxLeft && mx <= boxRight) {
        overlayCanvas.style.cursor = "grab";
      } else {
        overlayCanvas.style.cursor = "default";
      }
    };

    const onWindowMouseMove = (e: MouseEvent) => {
      if (!drag) return;
      const delta = e.clientX - drag.startClientX;
      if (drag.mode === "pan") {
        const newOffsetX = clampOffsetX(
          drag.startOffsetX - (delta * drag.startScale) / scaleX,
          drag.startScale,
        );
        setDrawOptions((prev) => ({ ...prev, offsetX: newOffsetX }));
      } else if (drag.mode === "resize-right") {
        const newBoxW = Math.max(1, drag.startBoxW + delta);
        const newScale = clampScale((W * scaleX) / newBoxW);
        const viewStart = -drag.startOffsetX / drag.startScale;
        const newOffsetX = clampOffsetX(-viewStart * newScale, newScale);
        setDrawOptions((prev) => ({
          ...prev,
          scale: newScale,
          offsetX: newOffsetX,
        }));
      } else {
        const newBoxW = Math.max(1, drag.startBoxW - delta);
        const newScale = clampScale((W * scaleX) / newBoxW);
        const viewEnd = (W - drag.startOffsetX) / drag.startScale;
        const newOffsetX = clampOffsetX(W - viewEnd * newScale, newScale);
        setDrawOptions((prev) => ({
          ...prev,
          scale: newScale,
          offsetX: newOffsetX,
        }));
      }
    };

    const onMouseUp = () => {
      drag = null;
    };

    overlayCanvas.addEventListener("mousedown", onMouseDown);
    overlayCanvas.addEventListener("mousemove", onCanvasMouseMove);
    window.addEventListener("mousemove", onWindowMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      overlayCanvas.removeEventListener("mousedown", onMouseDown);
      overlayCanvas.removeEventListener("mousemove", onCanvasMouseMove);
      window.removeEventListener("mousemove", onWindowMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [isMinimap, overlayRef, nCols, cellSize, setDrawOptions, width]);

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

export default function MSA(): JSX.Element {
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

  const LABEL_WIDTH = 150;
  const [containerRef, containerWidth] = useContainerWidth(LABEL_WIDTH + 300);
  const canvasWidth = Math.max(300, containerWidth - LABEL_WIDTH);

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
          <ul className="menu menu-sm lg:menu-horizontal bg-base-200 rounded-box z-20">
            <li>
              <details>
                <summary>Analyse</summary>
                <ul>
                  <li>
                    <button
                      onClick={handleRunNJ}
                      disabled={njStatus === "running"}
                    >
                      Build NJ tree
                      {njStatus === "running" && (
                        <span className="loading loading-spinner loading-xs opacity-50" />
                      )}
                    </button>
                  </li>
                </ul>
              </details>
            </li>
            <li>
              <details>
                <summary>View</summary>
                <ul>
                  <li>
                    <label className="flex items-center justify-between cursor-pointer">
                      Show letters
                      <input
                        type="checkbox"
                        className="toggle toggle-xs"
                        checked={showLetters}
                        onChange={() =>
                          setDrawOptions({ showLetters: !showLetters })
                        }
                      />
                    </label>
                  </li>
                  <li>
                    <label className="flex items-center justify-between cursor-pointer">
                      Show consensus
                      <input
                        type="checkbox"
                        className="toggle toggle-xs"
                        checked={showConsensus}
                        onChange={() =>
                          setDrawOptions({ showConsensus: !showConsensus })
                        }
                      />
                    </label>
                  </li>
                  <li>
                    <label className="flex items-center justify-between cursor-pointer">
                      Conservation track
                      <input
                        type="checkbox"
                        className="toggle toggle-xs"
                        checked={isConservation}
                        onChange={() =>
                          setDrawOptions({ isConservation: !isConservation })
                        }
                      />
                    </label>
                  </li>
                  <li>
                    <a className="menu-title">Colour options</a>
                    <ul>
                      {COLOR_SCHEME_GROUPS.map((group) => (
                        <>
                          <li
                            key={group.label}
                            className="menu-title text-xs pt-2"
                          >
                            {group.label}
                          </li>
                          {group.schemes.map((colorStyle) => (
                            <li key={colorStyle}>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="radio"
                                  className="radio radio-xs"
                                  name="colorStyle"
                                  checked={colorStyle === currentColorStyle}
                                  onChange={() =>
                                    setDrawOptions({ colorStyle })
                                  }
                                />
                                {colorStyle}
                              </label>
                            </li>
                          ))}
                        </>
                      ))}
                    </ul>
                  </li>
                </ul>
              </details>
            </li>
          </ul>
          {/* Minimap */}
          <div className="flex" style={{ marginBottom: 4 }}>
            <div style={{ width: LABEL_WIDTH, flexShrink: 0 }} />
            <MSACanvas isMinimap width={canvasWidth} />
          </div>

          {/* Main canvas with labels */}
          <div className="flex">
            <div
              style={{
                width: LABEL_WIDTH,
                height: (nRows + (showConsensus ? 1 : 0)) * 16,
                overflow: "hidden",
                flexShrink: 0,
              }}
            >
              <div style={{ transform: `translateY(${offsetY}px)` }}>
                {showConsensus && (
                  <div
                    style={{
                      height: 16,
                      lineHeight: "16px",
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
                    key={i}
                    style={{
                      height: 16,
                      lineHeight: "16px",
                      fontSize: 11,
                      fontFamily: "monospace",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      paddingRight: 8,
                      textAlign: "right",
                      opacity: 0.45,
                    }}
                  >
                    {seq.identifier}
                  </div>
                ))}
              </div>
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
