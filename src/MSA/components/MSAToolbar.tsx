import type { JSX } from "react";
import AnalyseDropdown from "./AnalyseDropdown";
import ViewDropdown from "./ViewDropdown";
import SearchBar from "./SearchBar";
import { useDrawStore } from "../stores/drawStore";
import { useMSAStore } from "../stores/msaStore";
import { COLOR_SCHEME_GROUPS, DEFAULT_COLOR_SCHEME } from "../colourSchemes";
import type { SequenceType } from "../types";
import UndoRedoButtons from "../../UndoRedoButtons";
import { Switch } from "@/components/ui/switch";

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
    <div className="flex items-center gap-1 bg-muted rounded-t-md px-1 py-1">
      <AnalyseDropdown />
      <ViewDropdown />

      <UndoRedoButtons />

      <SearchBar />

      {/* Sequence type toggle */}
      <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none ml-auto pr-1" title="Sequence type">
        <span
          className={effectiveType === "DNA" ? "font-semibold" : "opacity-50"}
          onClick={() => handleTypeChange("DNA")}
        >
          DNA{detectedSequenceType === "DNA" ? " (autodetected)" : ""}
        </span>
        <Switch
          size="sm"
          checked={effectiveType === "Protein"}
          onCheckedChange={(checked) => handleTypeChange(checked ? "Protein" : "DNA")}
        />
        <span
          className={effectiveType === "Protein" ? "font-semibold" : "opacity-50"}
          onClick={() => handleTypeChange("Protein")}
        >
          Protein{detectedSequenceType === "Protein" ? " (autodetected)" : ""}
        </span>
      </label>
    </div>
  );
}
