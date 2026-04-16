import { describe, it, expect, beforeEach } from "vitest";
import { useMSAStore } from "./msaStore";
import { useSequenceStore } from "../../sequenceStore";
import { useDrawStore } from "./drawStore";

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
      showLabels: true,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      isMinimap: false,
      cellSize: 16,
      colorStyle: "DNA",
      isConservation: false,
      highlightPattern: "",
      highlightUseRegex: false,
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
