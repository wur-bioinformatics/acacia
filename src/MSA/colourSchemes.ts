import type {
  ColorStyle,
  MSAColumnAnalysis,
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
    schemes: ["Parsimony Informative", "Conserved", "Variable"],
    type: null,
  },
];

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
): string {
  const upper = char.toUpperCase();
  const mode = darkMode ? "dark" : "light";
  const gap = darkMode ? GAP.dark : GAP.light;
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
    case "Parsimony Informative":
      return analysis.parsimonyInformativeSites.indexOf(col) > -1
        ? HIGHLIGHT_COLOR
        : gap;
    case "Variable":
      return analysis.variableSites.indexOf(col) > -1
        ? HIGHLIGHT_COLOR
        : gap;
    case "Conserved":
      return analysis.conservedSites.indexOf(col) > -1
        ? HIGHLIGHT_COLOR
        : gap;
    default:
      return unknown;
  }
}
