import { create } from "zustand";

type CanvasState = {
  mainCanvas: HTMLCanvasElement | null;
  mainOverlayCanvas: HTMLCanvasElement | null;
  minimapCanvas: HTMLCanvasElement | null;
  minimapOverlayCanvas: HTMLCanvasElement | null;
  setMainCanvas: (mainCanvas: HTMLCanvasElement | null) => void;
  setMainOverlayCanvas: (mainCanvas: HTMLCanvasElement | null) => void;
  setMinimapCanvas: (mainCanvas: HTMLCanvasElement | null) => void;
  setMinimapOverlayCanvas: (mainCanvas: HTMLCanvasElement | null) => void;
};

export const useCanvasStore = create<CanvasState>((set) => ({
  mainCanvas: null,
  mainOverlayCanvas: null,
  minimapCanvas: null,
  minimapOverlayCanvas: null,
  setMainCanvas: (mainCanvas) => set({ mainCanvas }),
  setMainOverlayCanvas: (mainOverlayCanvas) => set({ mainOverlayCanvas }),
  setMinimapCanvas: (minimapCanvas) => set({ minimapCanvas }),
  setMinimapOverlayCanvas: (minimapOverlayCanvas) =>
    set({ minimapOverlayCanvas }),
}));
