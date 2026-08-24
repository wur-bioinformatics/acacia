import type { DistConfig } from "@holmrenser/nj";

// nj.rs only re-exports the config types; derive the enums from them.
export type SubstitutionModel = DistConfig["substitution_model"];
export type Alphabet = NonNullable<DistConfig["alphabet"]>;

export type SubstitutionModelOption = {
  value: SubstitutionModel;
  label: string;
  description: string;
  /** Alphabet the model requires, or null when it works for both. */
  alphabet: Alphabet | null;
};

export const SUBSTITUTION_MODELS: SubstitutionModelOption[] = [
  { value: "PDiff", label: "PDiff", description: "p-distance", alphabet: null },
  { value: "JukesCantor", label: "Jukes-Cantor", description: "DNA only", alphabet: "DNA" },
  { value: "Kimura2P", label: "Kimura 2P", description: "DNA only", alphabet: "DNA" },
  { value: "TajimaNei", label: "Tajima-Nei", description: "DNA only", alphabet: "DNA" },
  { value: "Tamura", label: "Tamura", description: "DNA only", alphabet: "DNA" },
  { value: "Poisson", label: "Poisson", description: "protein only", alphabet: "Protein" },
  { value: "KimuraProtein", label: "Kimura (protein)", description: "protein only", alphabet: "Protein" },
];

export function modelLabel(model: string): string {
  return SUBSTITUTION_MODELS.find((m) => m.value === model)?.label ?? model;
}

export function isModelCompatible(model: SubstitutionModel, alphabet: Alphabet): boolean {
  const option = SUBSTITUTION_MODELS.find((m) => m.value === model);
  return option?.alphabet == null || option.alphabet === alphabet;
}

/** Human-readable summary of the rate-heterogeneity corrections in use. */
export function rateHetLabel(gammaShape: number | null, pInvar: number | null): string {
  const corrections: string[] = [];
  if (gammaShape != null) corrections.push(`Γ shape ${gammaShape}`);
  if (pInvar != null) corrections.push(`p-invar ${pInvar}`);
  return corrections.join(" · ");
}
