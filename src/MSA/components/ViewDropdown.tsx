import type { JSX } from "react";
import { Fragment } from "react";
import { COLOR_SCHEME_GROUPS } from "../colourSchemes";
import { useDrawStore } from "../stores/drawStore";
import { useMSAStore } from "../stores/msaStore";

export default function ViewDropdown({ id }: { id: string }): JSX.Element {
  const {
    drawOptions: {
      showLetters,
      showConsensus,
      showLabels,
      showMinimap,
      colorStyle: currentColorStyle,
    },
    sequenceTypeOverride,
    activeTrack,
    setDrawOptions,
    setActiveTrack,
  } = useDrawStore();
  const { detectedSequenceType } = useMSAStore();

  const effectiveType = sequenceTypeOverride ?? detectedSequenceType;

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
        <label className="flex items-center justify-between gap-6 cursor-pointer">
          Show minimap
          <input
            type="checkbox"
            className="toggle toggle-xs"
            checked={showMinimap}
            onChange={() => setDrawOptions({ showMinimap: !showMinimap })}
          />
        </label>
      </li>
      <li>
        <a className="menu-title">Track</a>
        <ul>
          <li>
            <label className="flex items-center gap-2 cursor-pointer whitespace-nowrap">
              <input
                type="radio"
                className="radio radio-xs"
                name="activeTrack"
                checked={activeTrack === null}
                onChange={() => setActiveTrack(null)}
              />
              None
            </label>
          </li>
          <li>
            <label className="flex items-center gap-2 cursor-pointer whitespace-nowrap">
              <input
                type="radio"
                className="radio radio-xs"
                name="activeTrack"
                checked={activeTrack === "conservation"}
                onChange={() => setActiveTrack("conservation")}
              />
              Conservation
            </label>
          </li>
          <li>
            <label className="flex items-center gap-2 cursor-pointer whitespace-nowrap">
              <input
                type="radio"
                className="radio radio-xs"
                name="activeTrack"
                checked={activeTrack === "logo"}
                onChange={() => setActiveTrack("logo")}
              />
              Logo
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
              <Fragment key={group.label}>
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
              </Fragment>
            );
          })}
        </ul>
      </li>
    </ul>
  );
}
