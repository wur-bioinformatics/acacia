import { DistConfig, DistanceResult, NJConfig } from "@holmrenser/nj";

export type NJOptions = {
  njConfig: NJConfig;
  onProgress?: (current: number, total: number) => void; // Optional callback for progress updates
};

export type DistanceOptions = {
  distConfig: DistConfig;
};

export type NJMessage =
  | { type: "runNJ"; data: Omit<NJOptions, "onProgress"> }
  | { type: "runDistances"; data: DistanceOptions };

export type NJResultMessage =
  | { type: "njResult"; newick: string; distanceMatrix: DistanceResult; avgDistance: number }
  | { type: "distanceResult"; distanceMatrix: DistanceResult; avgDistance: number }
  | { type: "njError"; error: string; code?: string }
  | { type: "njProgress"; current: number; total: number };
