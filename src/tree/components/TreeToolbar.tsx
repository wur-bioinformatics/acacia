import type { JSX } from "react";
import type { LayoutMode } from "../types";
import { useTreeStore } from "../treeStore";
import UndoRedoButtons from "../../UndoRedoButtons";
import { useNewickImport } from "../hooks/useNewickImport";
import SearchInput from "@/components/SearchInput";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type Props = {
  onExportSVG: () => void;
  onExportPNG: () => void;
  onExportNewick: () => void;
};

const layoutOptions: { value: LayoutMode; label: string }[] = [
  { value: "rectangular", label: "Rectangular" },
  { value: "cladogram", label: "Cladogram" },
  { value: "radial", label: "Radial" },
];

export default function TreeToolbar({ onExportSVG, onExportPNG, onExportNewick }: Props): JSX.Element {
  const isAtOriginalRoot = useTreeStore((s) => !s.flatTree?.isRerooted);
  const hasTree = useTreeStore((s) => s.flatTree !== null);
  const canRevertCollapse = useTreeStore((s) => s.preCollapseFlatTree !== null);
  const {
    layoutMode,
    showBootstrap,
    bootstrapThreshold,
    yStep,
    branchWidth,
    labelFontSize,
    nodeRadius,
    showBranchLengths,
    showScaleBar,
    searchQuery,
    searchUseRegex,
    dragEnabled,
    setLayoutMode,
    resetStyles,
    resetRoot,
    resetZoom,
    resetAll,
    setShowBootstrap,
    setBootstrapThreshold,
    setYStep,
    setBranchWidth,
    setLabelFontSize,
    setNodeRadius,
    setShowBranchLengths,
    setShowScaleBar,
    midpointRootTree,
    ladderize,
    collapseBelowBootstrap,
    revertBootstrapCollapse,
    setSearchQuery,
    setSearchUseRegex,
    setDragEnabled,
  } = useTreeStore();
  const { openPicker, elements: importElements } = useNewickImport();

  return (
    <div className="flex items-center gap-1 bg-muted rounded-t-md px-1 py-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">View</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-max p-2">
          <DropdownMenuLabel className="text-xs text-muted-foreground">Layout</DropdownMenuLabel>
          <RadioGroup
            value={layoutMode}
            onValueChange={(v) => setLayoutMode(v as LayoutMode)}
            className="gap-1 px-2"
          >
            {layoutOptions.map(({ value, label }) => (
              <label key={value} className="flex items-center gap-2 cursor-pointer whitespace-nowrap text-sm">
                <RadioGroupItem value={value} className="size-3" />
                {label}
              </label>
            ))}
          </RadioGroup>

          <DropdownMenuSeparator />

          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Show</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="p-1">
              <DropdownMenuCheckboxItem
                checked={showBootstrap}
                onCheckedChange={(c) => setShowBootstrap(!!c)}
              >
                Bootstrap values
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={showBranchLengths}
                onCheckedChange={(c) => setShowBranchLengths(!!c)}
              >
                Branch lengths
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={showScaleBar}
                onCheckedChange={(c) => setShowScaleBar(!!c)}
              >
                Scale bar
              </DropdownMenuCheckboxItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Sizes</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="p-2">
              <DropdownMenuLabel className="text-xs text-muted-foreground">Row height ({yStep}px)</DropdownMenuLabel>
              <div className="px-2 py-1">
                <Slider
                  className="w-40"
                  min={10}
                  max={60}
                  step={1}
                  value={[yStep]}
                  onValueChange={([v]) => setYStep(v)}
                />
              </div>
              <DropdownMenuLabel className="text-xs text-muted-foreground pt-2">
                Branch width ({branchWidth.toFixed(1)})
              </DropdownMenuLabel>
              <div className="px-2 py-1">
                <Slider
                  className="w-40"
                  min={0.5}
                  max={6}
                  step={0.5}
                  value={[branchWidth]}
                  onValueChange={([v]) => setBranchWidth(v)}
                />
              </div>
              <DropdownMenuLabel className="text-xs text-muted-foreground pt-2">
                Label size ({labelFontSize}px)
              </DropdownMenuLabel>
              <div className="px-2 py-1">
                <Slider
                  className="w-40"
                  min={8}
                  max={24}
                  step={1}
                  value={[labelFontSize]}
                  onValueChange={([v]) => setLabelFontSize(v)}
                />
              </div>
              <DropdownMenuLabel className="text-xs text-muted-foreground pt-2">
                Node radius ({nodeRadius}px)
              </DropdownMenuLabel>
              <div className="px-2 py-1">
                <Slider
                  className="w-40"
                  min={0}
                  max={8}
                  step={1}
                  value={[nodeRadius]}
                  onValueChange={([v]) => setNodeRadius(v)}
                />
              </div>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSeparator />

          <DropdownMenuItem onSelect={resetZoom}>Reset zoom</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">Arrange</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-max p-2">
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Root</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="p-1">
              <DropdownMenuItem disabled={!hasTree} onSelect={midpointRootTree}>
                Midpoint root
              </DropdownMenuItem>
              <DropdownMenuItem disabled={isAtOriginalRoot} onSelect={resetRoot}>
                Reset to original root
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Ladderize</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="p-1">
              <DropdownMenuItem disabled={!hasTree} onSelect={() => ladderize("asc")}>
                Smallest first
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!hasTree} onSelect={() => ladderize("desc")}>
                Largest first
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Bootstrap</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="p-2">
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Threshold ({bootstrapThreshold || "off"})
              </DropdownMenuLabel>
              <div className="px-2 py-1">
                <Slider
                  className="w-40"
                  min={0}
                  max={100}
                  step={1}
                  value={[bootstrapThreshold]}
                  onValueChange={([v]) => setBootstrapThreshold(v)}
                />
              </div>
              <DropdownMenuItem
                disabled={!hasTree || bootstrapThreshold === 0}
                onSelect={() => collapseBelowBootstrap(bootstrapThreshold)}
              >
                Collapse below threshold
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!canRevertCollapse}
                onSelect={revertBootstrapCollapse}
              >
                Revert collapse
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSeparator />

          <DropdownMenuItem onSelect={resetStyles}>
            Reset selection &amp; styling
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!hasTree} onSelect={resetAll}>
            Reset all
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">File</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-max p-1">
          <DropdownMenuItem onSelect={openPicker}>Import tree…</DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Export</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="p-1">
              <DropdownMenuItem onSelect={onExportSVG}>SVG</DropdownMenuItem>
              <DropdownMenuItem onSelect={onExportPNG}>PNG</DropdownMenuItem>
              <DropdownMenuItem onSelect={onExportNewick}>Newick</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>

      <UndoRedoButtons />

      <ToggleGroup
        type="single"
        value={dragEnabled ? "drag" : "inspect"}
        onValueChange={(v) => {
          if (v) setDragEnabled(v === "drag");
        }}
        variant="outline"
        size="sm"
      >
        <ToggleGroupItem value="inspect" title="Inspect mode — click nodes to open menu">
          <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor">
            <path d="M2 1 L2 9 L4.5 6.8 L6.2 10.5 L7.5 9.8 L5.8 6.1 L9 6.1 Z" />
          </svg>
        </ToggleGroupItem>
        <ToggleGroupItem value="drag" title="Drag mode — drag nodes to reorder">
          <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor">
            <rect x="1.75" y="4" width="1.5" height="5.5" rx="0.75" />
            <rect x="3.75" y="2.5" width="1.5" height="7" rx="0.75" />
            <rect x="5.75" y="2.5" width="1.5" height="7" rx="0.75" />
            <rect x="7.75" y="4" width="1.5" height="5.5" rx="0.75" />
            <rect x="1.75" y="7.5" width="7.5" height="3" rx="1.5" />
          </svg>
        </ToggleGroupItem>
      </ToggleGroup>

      <SearchInput
        value={searchQuery}
        onValueChange={setSearchQuery}
        useRegex={searchUseRegex}
        onToggleRegex={() => setSearchUseRegex(!searchUseRegex)}
      />

      {importElements}
    </div>
  );
}
