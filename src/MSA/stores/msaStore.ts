import { create } from "zustand";
import type { MSAData, SequenceType } from "../types";
import { useSequenceStore } from "../../sequenceStore";
import { detectSequenceType, DEFAULT_COLOR_SCHEME } from "../colourSchemes";
import { useDrawStore } from "./drawStore";
import { useEditStore } from "../../editStore";
import { useQualityStore } from "./qualityStore";
import { useNJStore } from "../../NJ/stores/njStore";
import { useTreeStore } from "../../tree/stores/treeStore";
import { useViewStore } from "../../viewStore";

type MSAState = {
  msaData: MSAData;
  detectedSequenceType: SequenceType;
  setMSAData: (msa: MSAData) => void;
};

export const useMSAStore = create<MSAState>((set) => ({
  msaData: [],
  detectedSequenceType: "DNA",
  setMSAData: (msaData) => {
    const detected = detectSequenceType(msaData);
    set({ msaData, detectedSequenceType: detected });

    // Loading a new alignment invalidates everything derived from the previous
    // one: order/selection, edit history, quality scores, the NJ tree and its
    // distance matrix, the tree view, and the MSA selection/viewport. Reset them
    // all so nothing stale lingers. Display preferences are intentionally kept.
    const sequenceStore = useSequenceStore.getState();
    sequenceStore.setOrder(msaData.map((s) => s.identifier));
    sequenceStore.setSelectedIdentifier(null);
    useEditStore.getState().setOriginalMSA(msaData);
    useQualityStore.getState().reset();
    useNJStore.getState().reset();
    useTreeStore.getState().reset();
    useDrawStore.getState().resetForNewMSA();
    useViewStore.getState().setView("MSA");

    const { sequenceTypeOverride, setDrawOptions } = useDrawStore.getState();
    if (sequenceTypeOverride === null) {
      setDrawOptions({ colorStyle: DEFAULT_COLOR_SCHEME[detected] });
    }
  },
}));
