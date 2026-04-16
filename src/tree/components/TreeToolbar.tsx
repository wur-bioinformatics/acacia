import type { JSX } from "react";
import type { LayoutMode } from "../types";
import { useTreeStore } from "../treeStore";

const layoutOptions: { value: LayoutMode; label: string }[] = [
  { value: "rectangular", label: "Rectangular" },
  { value: "cladogram", label: "Cladogram" },
  { value: "radial", label: "Radial" },
];

export default function TreeToolbar(): JSX.Element {
  const isAtOriginalRoot = useTreeStore((s) => !s.flatTree?.isRerooted);
  const {
    layoutMode,
    showBootstrap,
    yStep,
    setLayoutMode,
    resetStyles,
    resetRoot,
    setShowBootstrap,
    setYStep,
  } = useTreeStore();

  return (
    <>
      <ul className="menu menu-sm menu-horizontal bg-base-200 rounded-box z-20">
        <li>
          <button
            popoverTarget="tree-view-menu"
            style={{ anchorName: "--tree-view-menu" }}
          >
            View
          </button>
        </li>
        <li>
          <button
            onClick={resetRoot}
            disabled={isAtOriginalRoot}
            className="disabled:opacity-40"
          >
            Reset root
          </button>
        </li>
      </ul>

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
        <li className="menu-title pt-2">Row height</li>
        <li className="px-2">
          <input
            type="range"
            className="range range-xs w-36 [--range-fill:0]"
            min={10}
            max={60}
            step={1}
            value={yStep}
            onChange={(e) => setYStep(Number(e.target.value))}
          />
        </li>
        <li>
          <button className="w-full text-left" onClick={resetStyles}>
            Reset styles
          </button>
        </li>
      </ul>
    </>
  );
}
