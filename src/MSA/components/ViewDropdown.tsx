import type { JSX } from "react";
import React from "react";
import { COLOR_SCHEME_GROUPS, DEFAULT_COLOR_SCHEME } from "../colourSchemes";
import { useDrawStore } from "../stores/drawStore";
import { useMSAStore } from "../stores/msaStore";
import type { SequenceType } from "../types";

export default function ViewDropdown({ id }: { id: string }): JSX.Element {
  const {
    drawOptions: {
      showLetters,
      showConsensus,
      showLabels,
      colorStyle: currentColorStyle,
      isConservation,
    },
    sequenceTypeOverride,
    setDrawOptions,
    setSequenceTypeOverride,
  } = useDrawStore();
  const { detectedSequenceType } = useMSAStore();

  const effectiveType = sequenceTypeOverride ?? detectedSequenceType;

  function handleTypeChange(override: SequenceType | null) {
    const newEffective = override ?? detectedSequenceType;
    setSequenceTypeOverride(override);
    const currentGroup = COLOR_SCHEME_GROUPS.find((g) =>
      g.schemes.includes(currentColorStyle)
    );
    if (currentGroup?.type !== null && currentGroup?.type !== newEffective) {
      setDrawOptions({ colorStyle: DEFAULT_COLOR_SCHEME[newEffective] });
    }
  }

  return (
    <ul id={id} popover="auto" className="dropdown menu menu-sm bg-base-100 rounded-box shadow-lg min-w-max p-2" style={{ positionAnchor: `--${id}` }}>
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
        <a className="menu-title">Sequence type</a>
        <ul>
          <li>
            <label className="flex items-center gap-2 cursor-pointer whitespace-nowrap">
              <input
                type="radio"
                className="radio radio-xs"
                name="seqType"
                checked={sequenceTypeOverride === null}
                onChange={() => handleTypeChange(null)}
              />
              Auto
              <span className="text-xs opacity-50">({detectedSequenceType})</span>
            </label>
          </li>
          <li>
            <label className="flex items-center gap-2 cursor-pointer whitespace-nowrap">
              <input
                type="radio"
                className="radio radio-xs"
                name="seqType"
                checked={sequenceTypeOverride === "DNA"}
                onChange={() => handleTypeChange("DNA")}
              />
              DNA
            </label>
          </li>
          <li>
            <label className="flex items-center gap-2 cursor-pointer whitespace-nowrap">
              <input
                type="radio"
                className="radio radio-xs"
                name="seqType"
                checked={sequenceTypeOverride === "Protein"}
                onChange={() => handleTypeChange("Protein")}
              />
              Protein
            </label>
          </li>
        </ul>
      </li>
      <li>
        <a className="menu-title">Colour options</a>
        <ul>
          {COLOR_SCHEME_GROUPS.map((group) => {
            const groupDisabled = group.type !== null && group.type !== effectiveType;
            return (
              <React.Fragment key={group.label}>
                <li className={`menu-title text-xs pt-2 ${groupDisabled ? "opacity-30" : ""}`}>
                  {group.label}
                </li>
                {group.schemes.map((colorStyle) => (
                  <li key={colorStyle} className={groupDisabled ? "opacity-30" : ""}>
                    <label className={`flex items-center gap-2 whitespace-nowrap ${groupDisabled ? "cursor-not-allowed" : "cursor-pointer"}`}>
                      <input
                        type="radio"
                        className="radio radio-xs"
                        name="colorStyle"
                        checked={colorStyle === currentColorStyle}
                        disabled={groupDisabled}
                        onChange={() => setDrawOptions({ colorStyle })}
                      />
                      {colorStyle}
                    </label>
                  </li>
                ))}
              </React.Fragment>
            );
          })}
        </ul>
      </li>
    </ul>
  );
}
