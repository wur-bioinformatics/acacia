import { create } from "zustand";
import type { MSAData } from "../types";

type MSAState = {
  msaData: MSAData;
  setMSAData: (msa: MSAData) => void;
};

export const useMSAStore = create<MSAState>((set) => ({
  msaData: [],
  setMSAData: (msaData) => set({ msaData }),
}));
