import { useEffect } from "react";
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
import { NJOptions, useNJWorker } from "../NJ";
import { NJConfig } from "@holmrenser/nj";

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
  const { drawOptions } = useDrawStore();
  const { canvasRef, overlayRef } = useCanvasRefs({ isMinimap });
  useMainCanvasWorker({ canvasRef, msaData, drawOptions, isMinimap });
  const { offsetX, offsetY, scale } = drawOptions;

  const cellSize = 16;
  const nCols = msaData[0].sequence.length;

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
          pointerEvents: isMinimap ? "none" : "auto",
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

function makeTree(
  msaData: MSAData,
  runNJ: (options: NJOptions) => Promise<string>,
) {
  // Placeholder for NJ tree construction logic
  console.log("Running NJ algorithm on MSA data:", msaData);
  const njConfig: NJConfig = {
    msa: msaData,
    n_bootstrap_samples: 100,
    substitution_model: "PDiff",
  };

  const onProgress = (current: number, total: number) => {
    console.log(`Progress: ${current} / ${total}`);
  };

  runNJ({ njConfig, onProgress }).then((tree: string) => {
    console.log("NJ tree result:", tree);
  });
}

export default function MSA(): JSX.Element {
  const { msaData } = useMSAStore();
  const { runNJ } = useNJWorker();
  const nRows = msaData.length;
  const nCols = msaData[0]?.sequence.length ?? 0;
  const {
    drawOptions: { showLetters, colorStyle: currentColorStyle },
    setDrawOptions,
  } = useDrawStore();
  usePanZoom({ nRows, nCols });

  return (
    <>
      {!nRows && <MSAInput />}
      {!!nRows && (
        <>
          <MSACanvas isMinimap />
          <MSACanvas />
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
          {nRows && (
            <button
              className="btn btn-success"
              onClick={() => makeTree(msaData, runNJ)}
            >
              Run NJ and display tree (to be implemented)
            </button>
          )}
        </>
      )}
    </>
  );
}
