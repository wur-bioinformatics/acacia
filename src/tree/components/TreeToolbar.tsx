import type { JSX } from "react";
import type { LayoutMode } from "../types";
import { useTreeStore } from "../treeStore";
import UndoRedoButtons from "../../UndoRedoButtons";
import ImportNewickButton from "./ImportNewickButton";

type Props = {
  onExportSVG: () => void;
  onExportPNG: () => void;
  onExportNewick: () => void;
  onResetView?: () => void;
};

const layoutOptions: { value: LayoutMode; label: string }[] = [
  { value: "rectangular", label: "Rectangular" },
  { value: "cladogram", label: "Cladogram" },
  { value: "radial", label: "Radial" },
];

function hidePopover(id: string) {
  (document.getElementById(id) as HTMLElement & { hidePopover?: () => void })?.hidePopover?.();
}

export default function TreeToolbar({ onExportSVG, onExportPNG, onExportNewick, onResetView }: Props): JSX.Element {
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
    searchQuery,
    dragEnabled,
    setLayoutMode,
    resetStyles,
    resetRoot,
    setShowBootstrap,
    setBootstrapThreshold,
    setYStep,
    setBranchWidth,
    setLabelFontSize,
    setNodeRadius,
    setShowBranchLengths,
    midpointRootTree,
    ladderize,
    collapseBelowBootstrap,
    revertBootstrapCollapse,
    setSearchQuery,
    setDragEnabled,
  } = useTreeStore();
  const isRadial = layoutMode === "radial";

  return (
    <>
      <div className="flex items-center gap-2 bg-base-200 rounded-box z-20 px-1">
        <ul className="menu menu-sm menu-horizontal">
          <li>
            <button popoverTarget="tree-view-menu" style={{ anchorName: "--tree-view-menu" }}>
              View
            </button>
          </li>
          <li>
            <button popoverTarget="tree-style-menu" style={{ anchorName: "--tree-style-menu" }}>
              Style
            </button>
          </li>
          <li>
            <button popoverTarget="tree-arrange-menu" style={{ anchorName: "--tree-arrange-menu" }}>
              Arrange
            </button>
          </li>
          <li>
            <button onClick={resetRoot} disabled={isAtOriginalRoot} className="disabled:opacity-40">
              Reset root
            </button>
          </li>
          <li>
            <button onClick={midpointRootTree} disabled={!hasTree} className="disabled:opacity-40">
              Midpoint root
            </button>
          </li>
          <li>
            <button popoverTarget="tree-export-menu" style={{ anchorName: "--tree-export-menu" }}>
              Export
            </button>
          </li>
          <li>
            <ImportNewickButton />
          </li>
          {isRadial && onResetView && (
            <li>
              <button onClick={onResetView}>Reset view</button>
            </li>
          )}
        </ul>

        <UndoRedoButtons />

        <div className="join">
          <button
            className={`btn btn-xs join-item ${!dragEnabled ? "" : "opacity-40 hover:opacity-100 transition-opacity"}`}
            onClick={() => setDragEnabled(false)}
            title="Inspect mode — click nodes to open menu"
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor">
              <path d="M2 1 L2 9 L4.5 6.8 L6.2 10.5 L7.5 9.8 L5.8 6.1 L9 6.1 Z" />
            </svg>
          </button>
          <button
            className={`btn btn-xs join-item ${dragEnabled ? "" : "opacity-40 hover:opacity-100 transition-opacity"}`}
            onClick={() => setDragEnabled(true)}
            title="Drag mode — drag nodes to reorder"
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor">
              <rect x="1.75" y="4" width="1.5" height="5.5" rx="0.75" />
              <rect x="3.75" y="2.5" width="1.5" height="7" rx="0.75" />
              <rect x="5.75" y="2.5" width="1.5" height="7" rx="0.75" />
              <rect x="7.75" y="4" width="1.5" height="5.5" rx="0.75" />
              <rect x="1.75" y="7.5" width="7.5" height="3" rx="1.5" />
            </svg>
          </button>
        </div>

        <div className="relative flex items-center">
          <input
            type="text"
            className="input input-xs w-36 pr-5"
            placeholder="Search…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              className="absolute right-1 opacity-50 hover:opacity-100 text-xs"
              onClick={() => setSearchQuery("")}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <ul
        id="tree-view-menu"
        popover="auto"
        className="dropdown menu menu-sm bg-base-100 rounded-box shadow-lg min-w-max p-2"
        style={{ positionAnchor: "--tree-view-menu" }}
      >
        <li>
          <a className="menu-title">Layout</a>
          <ul>
            {layoutOptions.map(({ value, label }) => (
              <li key={value}>
                <label className="flex items-center gap-2 cursor-pointer whitespace-nowrap">
                  <input
                    type="radio"
                    className="radio radio-xs"
                    name="treeLayout"
                    checked={layoutMode === value}
                    onChange={() => setLayoutMode(value)}
                  />
                  {label}
                </label>
              </li>
            ))}
          </ul>
        </li>
        <li>
          <label className="flex items-center justify-between gap-6 cursor-pointer">
            Bootstrap values
            <input
              type="checkbox"
              className="toggle toggle-xs"
              checked={showBootstrap}
              onChange={() => setShowBootstrap(!showBootstrap)}
            />
          </label>
        </li>
        <li>
          <label className="flex items-center justify-between gap-6 cursor-pointer">
            Branch lengths
            <input
              type="checkbox"
              className="toggle toggle-xs"
              checked={showBranchLengths}
              onChange={() => setShowBranchLengths(!showBranchLengths)}
            />
          </label>
        </li>
        <li className="menu-title pt-2">Bootstrap threshold ({bootstrapThreshold || "off"})</li>
        <li className="px-2">
          <input
            type="range"
            className="range range-xs w-36 [--range-fill:0]"
            min={0}
            max={100}
            step={1}
            value={bootstrapThreshold}
            onChange={(e) => setBootstrapThreshold(Number(e.target.value))}
          />
        </li>
        <li>
          <button
            className="w-full text-left disabled:opacity-40"
            disabled={!hasTree || bootstrapThreshold === 0}
            onClick={() => collapseBelowBootstrap(bootstrapThreshold)}
          >
            Collapse below threshold
          </button>
        </li>
        <li>
          <button
            className="w-full text-left disabled:opacity-40"
            disabled={!canRevertCollapse}
            onClick={revertBootstrapCollapse}
          >
            Revert collapse
          </button>
        </li>
      </ul>

      <ul
        id="tree-style-menu"
        popover="auto"
        className="dropdown menu menu-sm bg-base-100 rounded-box shadow-lg min-w-max p-2"
        style={{ positionAnchor: "--tree-style-menu" }}
      >
        <li className="menu-title">Row height ({yStep}px)</li>
        <li className="px-2">
          <input
            type="range"
            className="range range-xs w-40 [--range-fill:0]"
            min={10}
            max={60}
            step={1}
            value={yStep}
            onChange={(e) => setYStep(Number(e.target.value))}
          />
        </li>
        <li className="menu-title pt-2">Branch width ({branchWidth.toFixed(1)})</li>
        <li className="px-2">
          <input
            type="range"
            className="range range-xs w-40 [--range-fill:0]"
            min={0.5}
            max={6}
            step={0.5}
            value={branchWidth}
            onChange={(e) => setBranchWidth(Number(e.target.value))}
          />
        </li>
        <li className="menu-title pt-2">Label size ({labelFontSize}px)</li>
        <li className="px-2">
          <input
            type="range"
            className="range range-xs w-40 [--range-fill:0]"
            min={8}
            max={24}
            step={1}
            value={labelFontSize}
            onChange={(e) => setLabelFontSize(Number(e.target.value))}
          />
        </li>
        <li className="menu-title pt-2">Node radius ({nodeRadius}px)</li>
        <li className="px-2">
          <input
            type="range"
            className="range range-xs w-40 [--range-fill:0]"
            min={0}
            max={8}
            step={1}
            value={nodeRadius}
            onChange={(e) => setNodeRadius(Number(e.target.value))}
          />
        </li>
        <li className="pt-2">
          <button className="w-full text-left" onClick={resetStyles}>
            Reset colors & collapse
          </button>
        </li>
      </ul>

      <ul
        id="tree-arrange-menu"
        popover="auto"
        className="dropdown menu menu-sm bg-base-100 rounded-box shadow-lg min-w-max p-2"
        style={{ positionAnchor: "--tree-arrange-menu" }}
      >
        <li className="menu-title">Ladderize</li>
        <li>
          <button
            className="w-full text-left disabled:opacity-40"
            disabled={!hasTree}
            onClick={() => {
              ladderize("asc");
              hidePopover("tree-arrange-menu");
            }}
          >
            Smallest first
          </button>
        </li>
        <li>
          <button
            className="w-full text-left disabled:opacity-40"
            disabled={!hasTree}
            onClick={() => {
              ladderize("desc");
              hidePopover("tree-arrange-menu");
            }}
          >
            Largest first
          </button>
        </li>
      </ul>

      <ul
        id="tree-export-menu"
        popover="auto"
        className="dropdown menu menu-sm bg-base-100 rounded-box shadow-lg min-w-max p-2"
        style={{ positionAnchor: "--tree-export-menu" }}
      >
        <li>
          <button
            className="w-full text-left"
            onClick={() => {
              onExportSVG();
              hidePopover("tree-export-menu");
            }}
          >
            SVG
          </button>
        </li>
        <li>
          <button
            className="w-full text-left"
            onClick={() => {
              onExportPNG();
              hidePopover("tree-export-menu");
            }}
          >
            PNG
          </button>
        </li>
        <li>
          <button
            className="w-full text-left"
            onClick={() => {
              onExportNewick();
              hidePopover("tree-export-menu");
            }}
          >
            Newick
          </button>
        </li>
      </ul>
    </>
  );
}
