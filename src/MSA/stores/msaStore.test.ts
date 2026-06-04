import { describe, it, expect, beforeEach } from "vitest";
import { useMSAStore } from "./msaStore";
import { useSequenceStore } from "../../sequenceStore";
import { useDrawStore } from "./drawStore";
import { useQualityStore } from "./qualityStore";
import { useNJStore } from "../../NJ/stores/njStore";
import { useTreeStore } from "../../tree/stores/treeStore";
import { useViewStore } from "../../viewStore";
import { flattenTree, parseNewick } from "../../tree/layout";

const dnaMsa = [
  { identifier: "s1", sequence: "ACGT" },
  { identifier: "s2", sequence: "TTAG" },
];

const proteinMsa = [
  { identifier: "p1", sequence: "ACGF" }, // F is protein-only
  { identifier: "p2", sequence: "MKLV" },
];

beforeEach(() => {
  useMSAStore.setState({ msaData: [], detectedSequenceType: "DNA" });
  useSequenceStore.setState({ order: [], selectedIdentifier: null });
  useDrawStore.setState({
    sequenceTypeOverride: null,
    drawOptions: {
      showLetters: true,
      showConsensus: true,
      showOnlyDifferences: true,
      showLabels: true,
      showMinimap: true,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      isMinimap: false,
      cellSize: 16,
      colorStyle: "DNA",
      conservationThreshold: 0.9,
      highlightPattern: "",
      highlightUseRegex: false,
      darkMode: false,
    },
  });
});

describe("msaStore setMSAData", () => {
  it("stores MSA data", () => {
    useMSAStore.getState().setMSAData(dnaMsa);
    expect(useMSAStore.getState().msaData).toEqual(dnaMsa);
  });

  it("detects DNA sequences as DNA", () => {
    useMSAStore.getState().setMSAData(dnaMsa);
    expect(useMSAStore.getState().detectedSequenceType).toBe("DNA");
  });

  it("detects protein sequences as Protein", () => {
    useMSAStore.getState().setMSAData(proteinMsa);
    expect(useMSAStore.getState().detectedSequenceType).toBe("Protein");
  });

  it("populates sequenceStore order with identifiers in input order", () => {
    useMSAStore.getState().setMSAData(dnaMsa);
    expect(useSequenceStore.getState().order).toEqual(["s1", "s2"]);
  });

  it("sets drawStore colorStyle to DNA scheme for DNA sequences", () => {
    useMSAStore.getState().setMSAData(dnaMsa);
    expect(useDrawStore.getState().drawOptions.colorStyle).toBe("DNA");
  });

  it("sets drawStore colorStyle to AA ClustalX for protein sequences", () => {
    useMSAStore.getState().setMSAData(proteinMsa);
    expect(useDrawStore.getState().drawOptions.colorStyle).toBe("AA ClustalX");
  });

  it("does not update colorStyle when sequenceTypeOverride is set", () => {
    useDrawStore.setState({ sequenceTypeOverride: "DNA" });
    useDrawStore.getState().setDrawOptions({ colorStyle: "AA Zappo" });
    useMSAStore.getState().setMSAData(proteinMsa);
    // colorStyle should remain as manually set — override suppresses auto-detection
    expect(useDrawStore.getState().drawOptions.colorStyle).toBe("AA Zappo");
  });

  it("handles empty input gracefully", () => {
    useMSAStore.getState().setMSAData([]);
    expect(useMSAStore.getState().msaData).toEqual([]);
    expect(useMSAStore.getState().detectedSequenceType).toBe("DNA");
    expect(useSequenceStore.getState().order).toEqual([]);
  });
});

describe("msaStore setMSAData resets derived state", () => {
  it("clears NJ tree results and distance matrix", () => {
    useNJStore.setState({
      newick: "(s1,s2);",
      distanceMatrix: { names: ["s1", "s2"], matrix: [[0, 1], [1, 0]] } as never,
      avgDistance: 1,
      status: "done",
    });
    useMSAStore.getState().setMSAData(dnaMsa);
    const nj = useNJStore.getState();
    expect(nj.newick).toBeNull();
    expect(nj.distanceMatrix).toBeNull();
    expect(nj.avgDistance).toBeNull();
    expect(nj.status).toBe("idle");
  });

  it("clears the loaded tree", () => {
    useTreeStore.getState().setFlatTree(flattenTree(parseNewick("(s1,s2);")));
    expect(useTreeStore.getState().flatTree).not.toBeNull();
    useMSAStore.getState().setMSAData(dnaMsa);
    expect(useTreeStore.getState().flatTree).toBeNull();
  });

  it("clears quality scores", () => {
    useQualityStore.setState({ trident: [0.1, 0.2], tridentStatus: "done" });
    useMSAStore.getState().setMSAData(dnaMsa);
    expect(useQualityStore.getState().trident).toBeNull();
    expect(useQualityStore.getState().tridentStatus).toBe("idle");
  });

  it("clears MSA selection and resets the viewport", () => {
    useDrawStore.setState({
      selection: { rows: new Set(["s1"]), columns: new Set([2]), lastRow: "s1", lastCol: 2 },
      activeTrack: "conservation",
    });
    useDrawStore.getState().setDrawOptions({ offsetX: 120, offsetY: 40 });
    useMSAStore.getState().setMSAData(dnaMsa);
    const draw = useDrawStore.getState();
    expect(draw.selection.rows.size).toBe(0);
    expect(draw.selection.columns.size).toBe(0);
    expect(draw.activeTrack).toBeNull();
    expect(draw.drawOptions.offsetX).toBe(0);
    expect(draw.drawOptions.offsetY).toBe(0);
  });

  it("clears the shared sequence selection", () => {
    useSequenceStore.setState({ selectedIdentifier: "s1" });
    useMSAStore.getState().setMSAData(dnaMsa);
    expect(useSequenceStore.getState().selectedIdentifier).toBeNull();
  });

  it("switches the active view back to MSA", () => {
    useViewStore.getState().setView("Tree");
    useMSAStore.getState().setMSAData(dnaMsa);
    expect(useViewStore.getState().view).toBe("MSA");
  });
});
