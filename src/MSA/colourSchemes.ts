import type {
  ColorStyle,
  MSAColumnAnalysis,
  MSAColumnStat,
  MSAData,
  SequenceType,
} from "./types";

const GAP = { light: "#f4f4f4", dark: "#2a2a2a" } as const;
const UNKNOWN = { light: "#cccccc", dark: "#4a4a4a" } as const;
const DNA_N = { light: "#e0e0e0", dark: "#4a4a4a" } as const;

type Scheme = { light: Map<string, string>; dark: Map<string, string> };

function makeScheme(
  entries: [string, string][],
  darkOverrides: [string, string][],
): Scheme {
  return {
    light: new Map(entries),
    dark: new Map([...entries, ...darkOverrides]),
  };
}

// DNA – default ACGT
export const dnaScheme = makeScheme(
  [
    ["A", "#4caf50"],
    ["C", "#2196f3"],
    ["G", "#ff9800"],
    ["T", "#f44336"],
    ["U", "#f44336"],
    ["N", DNA_N.light],
    ["-", GAP.light],
  ],
  [
    ["N", DNA_N.dark],
    ["-", GAP.dark],
  ],
);

// DNA – ClustalX traditional
export const dnaClustalXScheme = makeScheme(
  [
    ["A", "#64F73F"],
    ["C", "#FF7070"],
    ["G", "#FFB340"],
    ["T", "#4AC7FF"],
    ["U", "#4AC7FF"],
    ["-", GAP.light],
  ],
  [["-", GAP.dark]],
);

// Amino Acid – ClustalX (Jalview)
export const aaClustalXScheme = makeScheme(
  [
    ...["A", "V", "F", "P", "M", "I", "L", "W"].map(
      (c) => [c, "#80A0F0"] as [string, string],
    ),
    ...["K", "R"].map((c) => [c, "#F01505"] as [string, string]),
    ...["D", "E"].map((c) => [c, "#C048C0"] as [string, string]),
    ...["N", "Q", "S", "T"].map((c) => [c, "#15C015"] as [string, string]),
    ["C", "#F08080"],
    ["G", "#F09048"],
    ...["H", "Y"].map((c) => [c, "#15A4A4"] as [string, string]),
    ["-", GAP.light],
  ],
  [["-", GAP.dark]],
);

// Amino Acid – Zappo (physicochemical)
export const aaZappoScheme = makeScheme(
  [
    ...["I", "L", "V", "A", "M"].map((c) => [c, "#FFAFAF"] as [string, string]),
    ...["F", "W", "Y"].map((c) => [c, "#FFC800"] as [string, string]),
    ...["K", "R", "H"].map((c) => [c, "#6464FF"] as [string, string]),
    ...["D", "E"].map((c) => [c, "#FF0000"] as [string, string]),
    ...["S", "T", "N", "Q"].map((c) => [c, "#00DD00"] as [string, string]),
    ...["G", "P"].map((c) => [c, "#FF00FF"] as [string, string]),
    ["C", "#FFFF00"],
    ["-", GAP.light],
  ],
  [["-", GAP.dark]],
);

// Amino Acid – Taylor (spectral by residue index)
export const aaTaylorScheme = makeScheme(
  [
    ["A", "#CCFF00"],
    ["R", "#0000FF"],
    ["N", "#CC00FF"],
    ["D", "#FF0000"],
    ["C", "#FFFF00"],
    ["Q", "#FF00CC"],
    ["E", "#FF0066"],
    ["G", "#FF9900"],
    ["H", "#0066FF"],
    ["I", "#66FF00"],
    ["L", "#33FF00"],
    ["K", "#6600FF"],
    ["M", "#00FF00"],
    ["F", "#00FF66"],
    ["P", "#FFCC00"],
    ["S", "#FF3300"],
    ["T", "#FF6600"],
    ["W", "#00CCFF"],
    ["Y", "#00FFCC"],
    ["V", "#99FF00"],
    ["-", GAP.light],
  ],
  [["-", GAP.dark]],
);

export const COLOR_SCHEME_GROUPS: {
  label: string;
  schemes: ColorStyle[];
  type: SequenceType | null;
}[] = [
  { label: "DNA", schemes: ["DNA", "DNA ClustalX"], type: "DNA" },
  {
    label: "Amino Acid",
    schemes: ["AA ClustalX", "AA Zappo", "AA Taylor"],
    type: "Protein",
  },
  {
    label: "Analysis",
    schemes: ["Parsimony Informative", "Conserved", "% Conserved", "Variable"],
    type: null,
  },
  {
    label: "Quality",
    schemes: ["TRIDENT", "TCS"],
    type: null,
  },
];

const COLUMN_UNIFORM_STYLES: ReadonlySet<ColorStyle> = new Set([
  "Parsimony Informative",
  "Variable",
  "Conserved",
  "% Conserved",
  "TRIDENT",
]);

export function isColumnUniformStyle(style: ColorStyle): boolean {
  return COLUMN_UNIFORM_STYLES.has(style);
}

/** Score → CSS color. Shares hue interpolation with the conservation track. */
export function qualityGradient(score: number, darkMode: boolean): string {
  const clamped = Math.max(0, Math.min(1, score));
  const hue = 220 - clamped * 180;
  const sat = darkMode ? 55 : 70;
  const light = darkMode ? 38 : 50;
  return `hsl(${hue}, ${sat}%, ${light}%)`;
}

/** Color for a column under a column-uniform color style. Falls back to gap when scores are absent. */
export function columnColor(
  col: number,
  style: ColorStyle,
  analysis: MSAColumnAnalysis,
  trident: number[] | null,
  darkMode: boolean,
  columnStats: MSAColumnStat[] | null = null,
  conservationThreshold = 1,
): string {
  const gap = darkMode ? GAP.dark : GAP.light;
  switch (style) {
    case "Parsimony Informative":
      return analysis.parsimonyInformativeSites.indexOf(col) > -1 ? HIGHLIGHT_COLOR : gap;
    case "Variable":
      return analysis.variableSites.indexOf(col) > -1 ? HIGHLIGHT_COLOR : gap;
    case "Conserved":
      return analysis.conservedSites.indexOf(col) > -1 ? HIGHLIGHT_COLOR : gap;
    case "% Conserved":
      return columnStats &&
        (columnStats[col]?.identity ?? 0) >= conservationThreshold
        ? HIGHLIGHT_COLOR
        : gap;
    case "TRIDENT":
      return trident ? qualityGradient(trident[col] ?? 0, darkMode) : gap;
    default:
      return gap;
  }
}

export const DEFAULT_COLOR_SCHEME: Record<SequenceType, ColorStyle> = {
  DNA: "DNA",
  Protein: "AA ClustalX",
};

/** Detects sequence type by looking for amino-acid-only characters. */
export function detectSequenceType(msaData: MSAData): SequenceType {
  const proteinOnly = new Set(["E", "F", "I", "L", "P", "Q"]);
  for (const seq of msaData) {
    for (const char of seq.sequence) {
      if (proteinOnly.has(char.toUpperCase())) return "Protein";
    }
  }
  return "DNA";
}

const HIGHLIGHT_COLOR = "royalblue";

export function charToColor(
  char: string,
  col: number,
  style: ColorStyle,
  analysis: MSAColumnAnalysis,
  darkMode = false,
  trident: number[] | null = null,
  tcs: number[][] | null = null,
  row: number = -1,
  columnStats: MSAColumnStat[] | null = null,
  conservationThreshold = 1,
): string {
  const gap = darkMode ? GAP.dark : GAP.light;

  // TCS is per-residue: tcs[row][col]. Gap cells and consensus row fall back to gap color.
  if (style === "TCS") {
    if (char === "-" || row < 0 || !tcs) return gap;
    const rowScores = tcs[row];
    if (!rowScores) return gap;
    return qualityGradient(rowScores[col] ?? 0, darkMode);
  }

  if (isColumnUniformStyle(style)) {
    return columnColor(
      col,
      style,
      analysis,
      trident,
      darkMode,
      columnStats,
      conservationThreshold,
    );
  }
  const upper = char.toUpperCase();
  const mode = darkMode ? "dark" : "light";
  const unknown = darkMode ? UNKNOWN.dark : UNKNOWN.light;
  switch (style) {
    case "DNA":
      return dnaScheme[mode].get(upper) ?? gap;
    case "DNA ClustalX":
      return dnaClustalXScheme[mode].get(upper) ?? gap;
    case "AA ClustalX":
      return aaClustalXScheme[mode].get(upper) ?? gap;
    case "AA Zappo":
      return aaZappoScheme[mode].get(upper) ?? gap;
    case "AA Taylor":
      return aaTaylorScheme[mode].get(upper) ?? gap;
    default:
      return unknown;
  }
}
