import { useEffect, useRef, useState } from "react";
import type { JSX } from "react";
import type { LayoutMode } from "../types";
import { useTreeStore } from "../treeStore";

export default function TreeToolbar(): JSX.Element {
  const isAtOriginalRoot = useTreeStore((s) => s.flatTree?.rootId === s.flatTree?.originalRootId);
  const {
    layoutMode,
    showBootstrap,
    yStep,
    widthScale,
    setLayoutMode,
    resetZoom,
    resetStyles,
    resetRoot,
    setShowBootstrap,
    setYStep,
    setWidthScale,
  } = useTreeStore();
  const [openMenu, setOpenMenu] = useState<"view" | null>(null);
  const ref = useRef<HTMLUListElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const layoutOptions: { value: LayoutMode; label: string }[] = [
    { value: "rectangular", label: "Rectangular" },
    { value: "cladogram", label: "Cladogram" },
    { value: "radial", label: "Radial" },
  ];

  return (
    <ul
      ref={ref}
      className="menu menu-sm menu-horizontal bg-base-200 rounded-box z-20"
    >
      <li className="relative">
        <button
          onClick={() =>
            setOpenMenu((prev) => (prev === "view" ? null : "view"))
          }
        >
          View
        </button>
        {openMenu === "view" && (
          <ul className="absolute top-full left-0 mt-1 menu menu-sm bg-base-100 rounded-box shadow-lg z-20 min-w-max p-2">
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
                        onChange={() => {
                          setLayoutMode(value);
                          setOpenMenu(null);
                        }}
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
                className="range range-xs w-36"
                min={10}
                max={60}
                step={1}
                value={yStep}
                onChange={(e) => setYStep(Number(e.target.value))}
              />
            </li>
            <li className="menu-title pt-2">Tree width</li>
            <li className="px-2">
              <input
                type="range"
                className="range range-xs w-36"
                min={0.3}
                max={3}
                step={0.05}
                value={widthScale}
                onChange={(e) => setWidthScale(Number(e.target.value))}
              />
            </li>
            <li>
              <button className="w-full text-left" onClick={resetZoom}>
                Reset zoom
              </button>
            </li>
            <li>
              <button className="w-full text-left" onClick={resetStyles}>
                Reset styles
              </button>
            </li>
          </ul>
        )}
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
  );
}
