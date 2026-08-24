import type { JSX } from "react";
import type { SequenceType } from "../types";
import {
  SUBSTITUTION_MODELS,
  isModelCompatible,
  type SubstitutionModel,
} from "../../NJ/substitutionModels";
import { rateHetApplicable, type ModelSettings } from "../../NJ/modelSettings";
import { DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

type Props = {
  settings: ModelSettings;
  onChange: (patch: Partial<ModelSettings>) => void;
  sequenceType: SequenceType;
};

/**
 * Substitution model + rate-heterogeneity controls. Shared by the "Compute
 * distances" and "Build NJ tree" submenus, which run the same distance step.
 */
export default function SubstitutionModelSettings({
  settings,
  onChange,
  sequenceType,
}: Props): JSX.Element {
  const rateHet = rateHetApplicable(settings.substitutionModel);

  return (
    <>
      <DropdownMenuLabel className="text-xs text-muted-foreground">
        Substitution model
      </DropdownMenuLabel>
      <RadioGroup
        value={settings.substitutionModel}
        onValueChange={(v) => onChange({ substitutionModel: v as SubstitutionModel })}
        className="gap-1 px-2"
      >
        {SUBSTITUTION_MODELS.map(({ value, label, description }) => {
          const disabled = !isModelCompatible(value, sequenceType);
          return (
            <label
              key={value}
              className={`flex items-center gap-2 whitespace-nowrap text-sm ${disabled ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}`}
            >
              <RadioGroupItem value={value} disabled={disabled} className="size-3" />
              <span>{label}</span>
              <span className="opacity-40 text-xs">{description}</span>
            </label>
          );
        })}
      </RadioGroup>

      <DropdownMenuLabel className="text-xs text-muted-foreground pt-2">
        Rate heterogeneity
      </DropdownMenuLabel>
      <div className={`px-2 space-y-1.5 ${rateHet ? "" : "opacity-30"}`}>
        <label
          className={`flex items-center justify-between gap-4 text-sm ${rateHet ? "cursor-pointer" : "cursor-not-allowed"}`}
        >
          <span className="flex items-center gap-2 whitespace-nowrap">
            <Switch
              size="sm"
              checked={rateHet && settings.gammaEnabled}
              onCheckedChange={(gammaEnabled) => onChange({ gammaEnabled })}
              disabled={!rateHet}
            />
            Gamma shape α
          </span>
          <Input
            type="number"
            size="xs"
            className="w-20 text-center"
            min={0.01}
            step={0.1}
            value={settings.gammaShape}
            disabled={!rateHet || !settings.gammaEnabled}
            onChange={(e) =>
              onChange({ gammaShape: Math.max(0.01, parseFloat(e.target.value) || 0.01) })
            }
          />
        </label>
        <label
          className={`flex items-center justify-between gap-4 text-sm ${rateHet ? "cursor-pointer" : "cursor-not-allowed"}`}
        >
          <span className="flex items-center gap-2 whitespace-nowrap">
            <Switch
              size="sm"
              checked={rateHet && settings.pInvarEnabled}
              onCheckedChange={(pInvarEnabled) => onChange({ pInvarEnabled })}
              disabled={!rateHet}
            />
            Invariant sites
          </span>
          <Input
            type="number"
            size="xs"
            className="w-20 text-center"
            min={0}
            max={0.99}
            step={0.05}
            value={settings.pInvar}
            disabled={!rateHet || !settings.pInvarEnabled}
            onChange={(e) =>
              onChange({ pInvar: Math.min(0.99, Math.max(0, parseFloat(e.target.value) || 0)) })
            }
          />
        </label>
      </div>
    </>
  );
}
