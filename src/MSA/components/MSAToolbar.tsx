import type { JSX } from "react";
import FileDropdown from "./FileDropdown";
import AnalyseDropdown from "./AnalyseDropdown";
import EditDropdown from "./EditDropdown";
import ViewDropdown from "./ViewDropdown";
import SearchBar from "./SearchBar";
import { useDrawStore } from "../stores/drawStore";
import { useMSAStore } from "../stores/msaStore";
import { COLOR_SCHEME_GROUPS, DEFAULT_COLOR_SCHEME } from "../colourSchemes";
import type { SequenceType } from "../types";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Hand, MousePointer2, Rows3, Columns3 } from "lucide-react";
import { HelpButton } from "../../docs/HelpButton";

export default function MSAToolbar(): JSX.Element {
  const { sequenceTypeOverride, setSequenceTypeOverride, drawOptions: { colorStyle }, setDrawOptions } = useDrawStore();
  const interactionMode = useDrawStore((s) => s.interactionMode);
  const setInteractionMode = useDrawStore((s) => s.setInteractionMode);
  const selectionAxis = useDrawStore((s) => s.selectionAxis);
  const setSelectionAxis = useDrawStore((s) => s.setSelectionAxis);
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
    <div className="flex items-center gap-1 bg-muted rounded-t-md px-1 py-1" data-testid="msa-toolbar">
      <FileDropdown />
      <EditDropdown />
      <ViewDropdown />
      <AnalyseDropdown />

      {/* Interaction mode: pan vs select */}
      <ToggleGroup
        type="single"
        size="sm"
        variant="outline"
        value={interactionMode}
        onValueChange={(v) => v && setInteractionMode(v as "pan" | "select")}
      >
        <ToggleGroupItem value="pan" title="Pan / zoom (drag to pan)">
          <Hand className="size-3.5" />
        </ToggleGroupItem>
        <ToggleGroupItem value="select" title="Select (drag to select)">
          <MousePointer2 className="size-3.5" />
        </ToggleGroupItem>
      </ToggleGroup>

      {/* Selection axis: rows vs columns (only meaningful while selecting) */}
      <ToggleGroup
        type="single"
        size="sm"
        variant="outline"
        value={selectionAxis}
        onValueChange={(v) => v && setSelectionAxis(v as "rows" | "columns")}
        className={interactionMode === "select" ? "" : "opacity-40 pointer-events-none"}
        aria-disabled={interactionMode !== "select"}
      >
        <ToggleGroupItem value="rows" title="Select rows">
          <Rows3 className="size-3.5" />
        </ToggleGroupItem>
        <ToggleGroupItem value="columns" title="Select columns">
          <Columns3 className="size-3.5" />
        </ToggleGroupItem>
      </ToggleGroup>

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
      <HelpButton anchor="msa" label="MSA documentation" />
    </div>
  );
}
