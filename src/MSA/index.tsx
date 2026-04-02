import { useEffect, useRef } from "react";
import type { JSX } from "react";
import { exampleMsa } from "./example_data";

import "./styles.css";

import type { MSAData, SeqObject } from "./types";
import { COLORSTYLES } from "./types";

import { useDrawStore } from "./stores/drawStore";
import { useMSAStore } from "./stores/msaStore";
import usePanZoom from "./hooks/usePanZoom";
import useCanvasRefs from "./hooks/useCanvasRefs";
import useMainCanvasWorker from "./hooks/useMainCanvasWorker";
import { useNJWorker, useNJStore } from "../NJ";
import { useViewStore } from "../viewStore";
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
}: {
  isMinimap?: boolean;
}): JSX.Element {
  const { msaData } = useMSAStore();
  const { drawOptions, setDrawOptions } = useDrawStore();
  const { canvasRef, overlayRef } = useCanvasRefs({ isMinimap });
  useMainCanvasWorker({ canvasRef, msaData, drawOptions, isMinimap });
  const { offsetX, offsetY, scale } = drawOptions;

  const cellSize = 16;
  const nCols = msaData[0].sequence.length;

  const drawOptionsRef = useRef(drawOptions);
  drawOptionsRef.current = drawOptions;

  const mainWidth = 800;
  const mainHeight = isMinimap ? 50 : msaData.length * 16;

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
      ctx.strokeRect(0, row * cellSize + offsetY, mainWidth, cellSize);
      ctx.fillRect(0, row * cellSize + offsetY, mainWidth, cellSize);
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
  }, [scale, offsetX, offsetY, isMinimap, overlayRef, mainHeight]);

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

    const W = overlayCanvas.width;
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
      drag = { mode, startClientX: e.clientX, startOffsetX: offsetX, startScale: scale, startBoxLeft: boxLeft, startBoxW: boxW };
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
        const newOffsetX = clampOffsetX(drag.startOffsetX - delta * drag.startScale / scaleX, drag.startScale);
        setDrawOptions((prev) => ({ ...prev, offsetX: newOffsetX }));
      } else if (drag.mode === "resize-right") {
        const newBoxW = Math.max(1, drag.startBoxW + delta);
        const newScale = clampScale(W * scaleX / newBoxW);
        const viewStart = -drag.startOffsetX / drag.startScale;
        const newOffsetX = clampOffsetX(-viewStart * newScale, newScale);
        setDrawOptions((prev) => ({ ...prev, scale: newScale, offsetX: newOffsetX }));
      } else {
        const newBoxW = Math.max(1, drag.startBoxW - delta);
        const newScale = clampScale(W * scaleX / newBoxW);
        const viewEnd = (W - drag.startOffsetX) / drag.startScale;
        const newOffsetX = clampOffsetX(W - viewEnd * newScale, newScale);
        setDrawOptions((prev) => ({ ...prev, scale: newScale, offsetX: newOffsetX }));
      }
    };

    const onMouseUp = () => { drag = null; };

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
  }, [isMinimap, overlayRef, nCols, cellSize, setDrawOptions]);

  return (
    <div
      className="msa"
      style={{
        position: "relative",
        width: mainWidth,
        height: mainHeight,
        paddingBottom: isMinimap ? 10 : 0,
      }}
    >
      <canvas
        className="main-msa-canvas"
        ref={canvasRef}
        width={mainWidth}
        height={mainHeight}
        style={{ position: "absolute", top: 0, left: 0, zIndex: 1 }}
      />
      <canvas
        className="overlay-canvas"
        ref={overlayRef}
        width={mainWidth}
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
      const msa = parseFasta(text);
      console.log({ msa });
      setMSAData(msa);
    } catch (error) {
      console.error("Failed to read file:", error);
    }
  }
  return (
    <>
      <input
        className="file-input file-input-xs"
        id="file"
        type="file"
        onChange={handleFileChange}
      />
      <button
        className="btn btn-xs btn-soft btn-outline btn-info"
        onClick={() => {
          console.log({ exampleMsa });
          setMSAData(exampleMsa);
        }}
      >
        Load example data
      </button>
    </>
  );
}


export default function MSA(): JSX.Element {
  const { msaData } = useMSAStore();
  const { runNJ } = useNJWorker();
  const { status: njStatus, progress, setRunning, setResult, setError, setProgress } =
    useNJStore();
  const { setView } = useViewStore();
  const nRows = msaData.length;
  const nCols = msaData[0]?.sequence.length ?? 0;
  const {
    drawOptions: { showLetters, colorStyle: currentColorStyle, offsetY },
    setDrawOptions,
  } = useDrawStore();
  usePanZoom({ nRows, nCols });

  function handleRunNJ() {
    setRunning();
    const njConfig: NJConfig = {
      msa: msaData,
      n_bootstrap_samples: 100,
      substitution_model: "PDiff",
    };
    runNJ({ njConfig, onProgress: (current, total) => setProgress(current, total) })
      .then((newick) => {
        setResult(newick);
        setView("Tree");
      })
      .catch((err: Error) => setError(err.message));
  }

  return (
    <>
      {!nRows && <MSAInput />}
      {!!nRows && (
        <>
          <div style={{ display: "flex" }}>
            <div style={{ width: 150, flexShrink: 0 }} />
            <MSACanvas isMinimap />
          </div>
          <div style={{ display: "flex" }}>
            <div style={{ width: 150, height: nRows * 16, overflow: "hidden", flexShrink: 0 }}>
              <div style={{ transform: `translateY(${offsetY}px)` }}>
                {msaData.map((seq, i) => (
                  <div key={i} style={{ height: 16, lineHeight: "16px", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 6, textAlign: "right" }}>
                    {seq.identifier}
                  </div>
                ))}
              </div>
            </div>
            <MSACanvas />
          </div>
          <button
            className="btn"
            onClick={() =>
              setDrawOptions({ showLetters: showLetters ? false : true })
            }
          >
            {showLetters ? "Hide letters" : "Show letters"}
          </button>
          <fieldset>
            <legend>Select colorstyle</legend>
            {COLORSTYLES.map((colorStyle) => (
              <div key={colorStyle}>
                <input
                  type="radio"
                  id={colorStyle}
                  checked={colorStyle === currentColorStyle}
                  onChange={() => setDrawOptions({ colorStyle })}
                />
                <label htmlFor={colorStyle}>{colorStyle}</label>
              </div>
            ))}
          </fieldset>
          <hr />
          <section>
            File details:
            <ul>
              <li>Num. sequences: {nRows}</li>
              <li>Num. characters: {nCols}</li>
            </ul>
          </section>
          <div className="flex items-center gap-3 mt-2">
            <button
              className="btn btn-success"
              onClick={handleRunNJ}
              disabled={njStatus === "running"}
            >
              {njStatus === "running" ? "Building tree…" : "Build NJ tree"}
            </button>
            {njStatus === "running" && progress && (
              <span className="text-sm opacity-70">
                Bootstrap: {progress.current} / {progress.total}
              </span>
            )}
            {njStatus === "error" && (
              <span className="text-sm text-error">Tree build failed</span>
            )}
          </div>
        </>
      )}
    </>
  );
}
