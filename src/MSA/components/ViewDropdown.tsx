import type { JSX } from "react";
import React from "react";
import { COLOR_SCHEME_GROUPS } from "../colourSchemes";
import { useDrawStore } from "../stores/drawStore";

export default function ViewDropdown(): JSX.Element {
  const {
    drawOptions: {
      showLetters,
      showConsensus,
      showLabels,
      colorStyle: currentColorStyle,
      isConservation,
    },
    setDrawOptions,
  } = useDrawStore();

  return (
    <ul className="absolute top-full left-0 mt-1 menu menu-sm bg-base-100 rounded-box shadow-lg z-20 min-w-max p-2">
      <li>
        <label className="flex items-center justify-between gap-6 cursor-pointer">
          Show labels
          <input
            type="checkbox"
            className="toggle toggle-xs"
            checked={showLabels}
            onChange={() => setDrawOptions({ showLabels: !showLabels })}
          />
        </label>
      </li>
      <li>
        <label className="flex items-center justify-between gap-6 cursor-pointer">
          Show letters
          <input
            type="checkbox"
            className="toggle toggle-xs"
            checked={showLetters}
            onChange={() => setDrawOptions({ showLetters: !showLetters })}
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
            onChange={() => setDrawOptions({ showConsensus: !showConsensus })}
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
                onChange={() => setDrawOptions({ isConservation: false })}
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
                onChange={() => setDrawOptions({ isConservation: true })}
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
                      onChange={() => setDrawOptions({ colorStyle })}
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
  );
}
