import type { JSX } from "react";
import type { ColorStyle } from "../types";
import { COLOR_SCHEME_GROUPS } from "../colourSchemes";
import React, { useState, useEffect, useRef } from "react";

type Props = {
  showLetters: boolean;
  showConsensus: boolean;
  isConservation: boolean;
  currentColorStyle: ColorStyle;
  njStatus: string;
  onToggleLetters: () => void;
  onToggleConsensus: () => void;
  onToggleConservation: () => void;
  onColorStyleChange: (style: ColorStyle) => void;
  onRunNJ: () => void;
};

export default function MSAToolbar({
  showLetters,
  showConsensus,
  isConservation,
  currentColorStyle,
  njStatus,
  onToggleLetters,
  onToggleConsensus,
  onToggleConservation,
  onColorStyleChange,
  onRunNJ,
}: Props): JSX.Element {
  const [openMenu, setOpenMenu] = useState<"analyse" | "view" | null>(null);
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

  function toggle(menu: "analyse" | "view") {
    setOpenMenu((prev) => (prev === menu ? null : menu));
  }

  return (
    <ul ref={ref} className="menu menu-sm menu-horizontal bg-base-200 rounded-box z-20">
      <li className="relative">
        <button onClick={() => toggle("analyse")}>Analyse</button>
        {openMenu === "analyse" && (
          <ul className="absolute top-full left-0 mt-1 menu menu-sm bg-base-100 rounded-box shadow-lg z-20 min-w-max p-2">
            <li>
              <button onClick={onRunNJ} disabled={njStatus === "running"}>
                Build NJ tree
                {njStatus === "running" && (
                  <span className="loading loading-spinner loading-xs opacity-50" />
                )}
              </button>
            </li>
          </ul>
        )}
      </li>
      <li className="relative">
        <button onClick={() => toggle("view")}>View</button>
        {openMenu === "view" && (
          <ul className="absolute top-full left-0 mt-1 menu menu-sm bg-base-100 rounded-box shadow-lg z-20 min-w-max p-2">
            <li>
              <label className="flex items-center justify-between gap-6 cursor-pointer">
                Show letters
                <input
                  type="checkbox"
                  className="toggle toggle-xs"
                  checked={showLetters}
                  onChange={onToggleLetters}
                />
              </label>
            </li>
            <li>
              <label className="flex items-center justify-between gap-6 cursor-pointer">
                Show consensus
                <input
                  type="checkbox"
                  className="toggle toggle-xs"
                  checked={showConsensus}
                  onChange={onToggleConsensus}
                />
              </label>
            </li>
            <li>
              <a className="menu-title">Minimap</a>
              <ul>
                <li>
                  <label>
                    <input
                      type="radio"
                      className="radio radio-xs"
                      name="minimap"
                      checked={!isConservation}
                      onChange={() => onToggleConservation()}
                    />
                    Overview
                  </label>
                </li>
                <li>
                  <label>
                    <input
                      type="radio"
                      className="radio radio-xs"
                      name="minimap"
                      checked={isConservation}
                      onChange={() => onToggleConservation()}
                    />
                    Conservation
                  </label>
                </li>
              </ul>
            </li>
            <li>
              <a className="menu-title">Colour options</a>
              <ul>
                {COLOR_SCHEME_GROUPS.map((group) => (
                  <React.Fragment key={group.label}>
                    <li className="menu-title text-xs pt-2">{group.label}</li>
                    {group.schemes.map((colorStyle) => (
                      <li key={colorStyle}>
                        <label className="flex items-center gap-2 cursor-pointer whitespace-nowrap">
                          <input
                            type="radio"
                            className="radio radio-xs"
                            name="colorStyle"
                            checked={colorStyle === currentColorStyle}
                            onChange={() => onColorStyleChange(colorStyle)}
                          />
                          {colorStyle}
                        </label>
                      </li>
                    ))}
                  </React.Fragment>
                ))}
              </ul>
            </li>
          </ul>
        )}
      </li>
    </ul>
  );
}
