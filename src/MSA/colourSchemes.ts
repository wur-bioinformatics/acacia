import type { ColorStyle, MSAColumnAnalysis } from "./types";

// DNA – default ACGT
export const dnaColorMap = new Map([
  ["A", "#4caf50"],
  ["C", "#2196f3"],
  ["G", "#ff9800"],
  ["T", "#f44336"],
  ["U", "#f44336"],
  ["N", "#e0e0e0"],
  ["-", "#f4f4f4"],
]);

// DNA – ClustalX traditional
export const dnaClustalX = new Map([
  ["A", "#64F73F"],
  ["C", "#FF7070"],
  ["G", "#FFB340"],
  ["T", "#4AC7FF"],
  ["U", "#4AC7FF"],
  ["-", "#f4f4f4"],
]);

// Amino Acid – ClustalX (Jalview)
export const aaClustalX = new Map<string, string>([
  ...["A", "V", "F", "P", "M", "I", "L", "W"].map(
    (c) => [c, "#80A0F0"] as [string, string],
  ),
  ...["K", "R"].map((c) => [c, "#F01505"] as [string, string]),
  ...["D", "E"].map((c) => [c, "#C048C0"] as [string, string]),
  ...["N", "Q", "S", "T"].map((c) => [c, "#15C015"] as [string, string]),
  ["C", "#F08080"],
  ["G", "#F09048"],
  ...["H", "Y"].map((c) => [c, "#15A4A4"] as [string, string]),
  ["-", "#f4f4f4"],
]);

// Amino Acid – Zappo (physicochemical)
export const aaZappo = new Map<string, string>([
  ...["I", "L", "V", "A", "M"].map((c) => [c, "#FFAFAF"] as [string, string]),
  ...["F", "W", "Y"].map((c) => [c, "#FFC800"] as [string, string]),
  ...["K", "R", "H"].map((c) => [c, "#6464FF"] as [string, string]),
  ...["D", "E"].map((c) => [c, "#FF0000"] as [string, string]),
  ...["S", "T", "N", "Q"].map((c) => [c, "#00DD00"] as [string, string]),
  ...["G", "P"].map((c) => [c, "#FF00FF"] as [string, string]),
  ["C", "#FFFF00"],
  ["-", "#f4f4f4"],
]);

// Amino Acid – Taylor (spectral by residue index)
export const aaTaylor = new Map([
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
  ["-", "#f4f4f4"],
]);

export const COLOR_SCHEME_GROUPS: { label: string; schemes: ColorStyle[] }[] = [
  { label: "DNA", schemes: ["DNA", "DNA ClustalX"] },
  { label: "Amino Acid", schemes: ["AA ClustalX", "AA Zappo", "AA Taylor"] },
  {
    label: "Analysis",
    schemes: ["Parsimony Informative", "Conserved", "Variable"],
  },
];

const HIGHLIGHT_COLOR = "royalblue";
const UNKNOWN_COLOR = "#cccccc";
const GAP_COLOR = "#f4f4f4";

export function charToColor(
  char: string,
  col: number,
  style: ColorStyle,
  analysis: MSAColumnAnalysis,
): string {
  const upper = char.toUpperCase();
  switch (style) {
    case "DNA":
      return dnaColorMap.get(upper) ?? GAP_COLOR;
    case "DNA ClustalX":
      return dnaClustalX.get(upper) ?? GAP_COLOR;
    case "AA ClustalX":
      return aaClustalX.get(upper) ?? GAP_COLOR;
    case "AA Zappo":
      return aaZappo.get(upper) ?? GAP_COLOR;
    case "AA Taylor":
      return aaTaylor.get(upper) ?? GAP_COLOR;
    case "Parsimony Informative":
      return analysis.parsimonyInformativeSites.indexOf(col) > -1
        ? HIGHLIGHT_COLOR
        : GAP_COLOR;
    case "Variable":
      return analysis.variableSites.indexOf(col) > -1
        ? HIGHLIGHT_COLOR
        : GAP_COLOR;
    case "Conserved":
      return analysis.conservedSites.indexOf(col) > -1
        ? HIGHLIGHT_COLOR
        : GAP_COLOR;
    default:
      return UNKNOWN_COLOR;
  }
}
