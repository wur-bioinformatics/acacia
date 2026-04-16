import type { JSX } from "react";
import AnalyseDropdown from "./AnalyseDropdown";
import ViewDropdown from "./ViewDropdown";
import SearchBar from "./SearchBar";
import { useDrawStore } from "../stores/drawStore";
import { useMSAStore } from "../stores/msaStore";
import { COLOR_SCHEME_GROUPS, DEFAULT_COLOR_SCHEME } from "../colourSchemes";
import type { SequenceType } from "../types";

export default function MSAToolbar(): JSX.Element {
  const { interactionMode, setInteractionMode, sequenceTypeOverride, setSequenceTypeOverride, drawOptions: { colorStyle }, setDrawOptions } = useDrawStore();
  const { detectedSequenceType } = useMSAStore();

  const effectiveType = sequenceTypeOverride ?? detectedSequenceType;

  function handleTypeChange(type: SequenceType) {
    // Clicking the auto-detected side clears the override; otherwise set it explicitly
    const override = type === detectedSequenceType ? null : type;
    const newEffective = override ?? detectedSequenceType;
    setSequenceTypeOverride(override);
    const currentGroup = COLOR_SCHEME_GROUPS.find((g) => g.schemes.includes(colorStyle));
    if (currentGroup?.type !== null && currentGroup?.type !== newEffective) {
      setDrawOptions({ colorStyle: DEFAULT_COLOR_SCHEME[newEffective] });
    }
  }

  return (
    <>
      <div className="flex items-center gap-2 bg-base-200 rounded-box rounded-b-none px-1 w-full">
        <ul className="menu menu-sm menu-horizontal">
          <li>
            <button
              popoverTarget="msa-analyse-menu"
              style={{ anchorName: "--msa-analyse-menu" }}
            >
              Analyse
            </button>
          </li>
          <li>
            <button
              popoverTarget="msa-view-menu"
              style={{ anchorName: "--msa-view-menu" }}
            >
              View
            </button>
          </li>
        </ul>

        {/* Interaction mode toggle */}
        <div className="join" title="Interaction mode">
          <button
            className={`join-item btn btn-xs${interactionMode === "pointer" ? " btn-primary" : ""}`}
            onClick={() => setInteractionMode("pointer")}
            title="Pointer — hover to highlight row & column"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 3l14 9-7 1-4 7L5 3z" />
            </svg>
          </button>
          <button
            className={`join-item btn btn-xs${interactionMode === "hand" ? " btn-primary" : ""}`}
            onClick={() => setInteractionMode("hand")}
            title="Hand — drag to pan"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 11V6a2 2 0 0 0-4 0v5" />
              <path d="M14 10V4a2 2 0 0 0-4 0v6" />
              <path d="M10 10.5V6a2 2 0 0 0-4 0v8" />
              <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L8 15" />
            </svg>
          </button>
        </div>

        <SearchBar />

        {/* Sequence type toggle */}
        <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none ml-auto pr-1" title="Sequence type">
          <span
            className={effectiveType === "DNA" ? "font-semibold" : "opacity-50"}
            onClick={() => handleTypeChange("DNA")}
          >
            DNA{detectedSequenceType === "DNA" ? " (autodetected)" : ""}
          </span>
          <input
            type="checkbox"
            className="toggle toggle-xs"
            checked={effectiveType === "Protein"}
            onChange={(e) => handleTypeChange(e.target.checked ? "Protein" : "DNA")}
          />
          <span
            className={effectiveType === "Protein" ? "font-semibold" : "opacity-50"}
            onClick={() => handleTypeChange("Protein")}
          >
            Protein{detectedSequenceType === "Protein" ? " (autodetected)" : ""}
          </span>
        </label>
      </div>
      <AnalyseDropdown id="msa-analyse-menu" />
      <ViewDropdown id="msa-view-menu" />
    </>
  );
}
