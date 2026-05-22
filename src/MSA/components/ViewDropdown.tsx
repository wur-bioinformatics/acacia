import type { JSX } from "react";
import { Fragment } from "react";
import { COLOR_SCHEME_GROUPS } from "../colourSchemes";
import { useDrawStore } from "../stores/drawStore";
import { useMSAStore } from "../stores/msaStore";
import { useQualityStore } from "../stores/qualityStore";
import type { ColorStyle, TrackType } from "../types";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";

const QUALITY_SCHEMES: ReadonlySet<ColorStyle> = new Set(["TRIDENT", "TCS"]);

export default function ViewDropdown(): JSX.Element {
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
  const qualityReady = useQualityStore(
    (s) => s.status === "done" && s.trident !== null && s.tcs !== null,
  );

  const effectiveType = sequenceTypeOverride ?? detectedSequenceType;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm">View</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-max p-2">
        <DropdownMenuCheckboxItem
          checked={showLabels}
          onCheckedChange={() => setDrawOptions({ showLabels: !showLabels })}
        >
          Show labels
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={showLetters}
          onCheckedChange={() => setDrawOptions({ showLetters: !showLetters })}
        >
          Show letters
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={showConsensus}
          onCheckedChange={() => setDrawOptions({ showConsensus: !showConsensus })}
        >
          Show consensus
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={showMinimap}
          onCheckedChange={() => setDrawOptions({ showMinimap: !showMinimap })}
        >
          Show minimap
        </DropdownMenuCheckboxItem>

        <DropdownMenuLabel className="text-xs text-muted-foreground pt-2">Track</DropdownMenuLabel>
        <RadioGroup
          value={activeTrack ?? "none"}
          onValueChange={(v) => setActiveTrack(v === "none" ? null : (v as TrackType))}
          className="gap-1 px-2"
        >
          <label className="flex items-center gap-2 cursor-pointer whitespace-nowrap text-sm">
            <RadioGroupItem value="none" className="size-3" />
            None
          </label>
          <label className="flex items-center gap-2 cursor-pointer whitespace-nowrap text-sm">
            <RadioGroupItem value="conservation" className="size-3" />
            Conservation
          </label>
          <label className="flex items-center gap-2 cursor-pointer whitespace-nowrap text-sm">
            <RadioGroupItem value="logo" className="size-3" />
            Logo
          </label>
          <label
            className={`flex items-center gap-2 whitespace-nowrap text-sm ${qualityReady ? "cursor-pointer" : "opacity-30 cursor-not-allowed"}`}
          >
            <RadioGroupItem value="trident" disabled={!qualityReady} className="size-3" />
            TRIDENT
          </label>
          <label
            className={`flex items-center gap-2 whitespace-nowrap text-sm ${qualityReady ? "cursor-pointer" : "opacity-30 cursor-not-allowed"}`}
          >
            <RadioGroupItem value="tcs" disabled={!qualityReady} className="size-3" />
            TCS
          </label>
        </RadioGroup>

        <DropdownMenuLabel className="text-xs text-muted-foreground pt-2">Colour options</DropdownMenuLabel>
        <RadioGroup
          value={currentColorStyle}
          onValueChange={(v) => setDrawOptions({ colorStyle: v as ColorStyle })}
          className="gap-1 px-2"
        >
          {COLOR_SCHEME_GROUPS.map((group) => {
            const groupDisabled = group.type !== null && group.type !== effectiveType;
            return (
              <Fragment key={group.label}>
                <div className={`text-xs pt-2 ${groupDisabled ? "opacity-30" : "text-muted-foreground"}`}>
                  {group.label}
                </div>
                {group.schemes.map((colorStyle) => {
                  const disabled =
                    groupDisabled ||
                    (QUALITY_SCHEMES.has(colorStyle) && !qualityReady);
                  return (
                    <label
                      key={colorStyle}
                      className={`flex items-center gap-2 whitespace-nowrap text-sm ${disabled ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}`}
                    >
                      <RadioGroupItem
                        value={colorStyle}
                        disabled={disabled}
                        className="size-3"
                      />
                      {colorStyle}
                    </label>
                  );
                })}
              </Fragment>
            );
          })}
        </RadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
