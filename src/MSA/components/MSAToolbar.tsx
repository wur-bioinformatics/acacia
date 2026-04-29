import type { JSX } from "react";
import AnalyseDropdown from "./AnalyseDropdown";
import ViewDropdown from "./ViewDropdown";
import SearchBar from "./SearchBar";
import { useDrawStore } from "../stores/drawStore";
import { useMSAStore } from "../stores/msaStore";
import { COLOR_SCHEME_GROUPS, DEFAULT_COLOR_SCHEME } from "../colourSchemes";
import type { SequenceType } from "../types";
import UndoRedoButtons from "../../UndoRedoButtons";

export default function MSAToolbar(): JSX.Element {
  const { sequenceTypeOverride, setSequenceTypeOverride, drawOptions: { colorStyle }, setDrawOptions } = useDrawStore();
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

        <SearchBar />

        <UndoRedoButtons />

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
