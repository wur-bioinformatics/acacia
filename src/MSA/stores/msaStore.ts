import { create } from "zustand";
import type { MSAData, SequenceType } from "../types";
import { useSequenceStore } from "../../sequenceStore";
import { detectSequenceType, DEFAULT_COLOR_SCHEME } from "../colourSchemes";
import { useDrawStore } from "./drawStore";

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
    useSequenceStore.getState().setOrder(msaData.map((s) => s.identifier));
    const { sequenceTypeOverride, setDrawOptions } = useDrawStore.getState();
    if (sequenceTypeOverride === null) {
      setDrawOptions({ colorStyle: DEFAULT_COLOR_SCHEME[detected] });
    }
  },
}));
