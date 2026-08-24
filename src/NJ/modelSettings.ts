import type { SubstitutionModel } from "./substitutionModels";

/** Model settings for a distance computation, as nj.rs expects them. */
export type DistanceSettings = {
  substitutionModel: SubstitutionModel;
  /** Gamma shape α, or null for uniform rates. */
  gammaShape: number | null;
  /** Proportion of invariant sites, or null for no correction. */
  pInvar: number | null;
};

export type TreeSettings = DistanceSettings & {
  nBootstrapSamples: number;
};

/** UI state of the model picker; the toggles collapse into nullable params on run. */
export type ModelSettings = {
  substitutionModel: SubstitutionModel;
  gammaEnabled: boolean;
  gammaShape: number;
  pInvarEnabled: boolean;
  pInvar: number;
};

export const DEFAULT_MODEL_SETTINGS: ModelSettings = {
  substitutionModel: "PDiff",
  gammaEnabled: false,
  gammaShape: 1.0,
  pInvarEnabled: false,
  pInvar: 0.2,
};

// Gamma / invariant-sites corrections have no effect on the raw p-distance model.
export function rateHetApplicable(model: SubstitutionModel): boolean {
  return model !== "PDiff";
}

/** Collapses the picker's toggles into the params nj.rs expects. */
export function toDistanceSettings(settings: ModelSettings): DistanceSettings {
  const rateHet = rateHetApplicable(settings.substitutionModel);
  return {
    substitutionModel: settings.substitutionModel,
    gammaShape: rateHet && settings.gammaEnabled ? settings.gammaShape : null,
    pInvar: rateHet && settings.pInvarEnabled ? settings.pInvar : null,
  };
}
