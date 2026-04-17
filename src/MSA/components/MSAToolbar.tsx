import type { JSX } from "react";
import AnalyseDropdown from "./AnalyseDropdown";
import ViewDropdown from "./ViewDropdown";
import SearchBar from "./SearchBar";
import { useDrawStore } from "../stores/drawStore";
import { useMSAStore } from "../stores/msaStore";
import { COLOR_SCHEME_GROUPS, DEFAULT_COLOR_SCHEME } from "../colourSchemes";
import type { SequenceType } from "../types";

export default function MSAToolbar(): JSX.Element {
  const { scrollMode, setScrollMode, sequenceTypeOverride, setSequenceTypeOverride, drawOptions: { colorStyle }, setDrawOptions } = useDrawStore();
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

        {/* Scroll wheel mode toggle */}
        <div className="join" title="Scroll wheel mode">
          <button
            className={`join-item btn btn-xs${scrollMode === "zoom" ? " btn-primary" : ""}`}
            onClick={() => setScrollMode("zoom")}
            title="Scroll to zoom"
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
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
              <line x1="11" y1="8" x2="11" y2="14" />
              <line x1="8" y1="11" x2="14" y2="11" />
            </svg>
          </button>
          <button
            className={`join-item btn btn-xs${scrollMode === "pan" ? " btn-primary" : ""}`}
            onClick={() => setScrollMode("pan")}
            title="Scroll to pan"
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
              <polyline points="5 9 2 12 5 15" />
              <polyline points="9 5 12 2 15 5" />
              <polyline points="15 19 12 22 9 19" />
              <polyline points="19 9 22 12 19 15" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <line x1="12" y1="2" x2="12" y2="22" />
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
