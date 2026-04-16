import { createContext, useContext, useState } from "react";
import type { JSX, ReactNode } from "react";

export type CanvasState = {
  mainCanvas: HTMLCanvasElement | null;
  mainOverlayCanvas: HTMLCanvasElement | null;
  minimapCanvas: HTMLCanvasElement | null;
  minimapOverlayCanvas: HTMLCanvasElement | null;
  setMainCanvas: (el: HTMLCanvasElement | null) => void;
  setMainOverlayCanvas: (el: HTMLCanvasElement | null) => void;
  setMinimapCanvas: (el: HTMLCanvasElement | null) => void;
  setMinimapOverlayCanvas: (el: HTMLCanvasElement | null) => void;
};

const CanvasContext = createContext<CanvasState | null>(null);

export function CanvasProvider({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
  const [mainCanvas, setMainCanvas] = useState<HTMLCanvasElement | null>(null);
  const [mainOverlayCanvas, setMainOverlayCanvas] =
    useState<HTMLCanvasElement | null>(null);
  const [minimapCanvas, setMinimapCanvas] = useState<HTMLCanvasElement | null>(
    null,
  );
  const [minimapOverlayCanvas, setMinimapOverlayCanvas] =
    useState<HTMLCanvasElement | null>(null);

  return (
    <CanvasContext.Provider
      value={{
        mainCanvas,
        mainOverlayCanvas,
        minimapCanvas,
        minimapOverlayCanvas,
        setMainCanvas,
        setMainOverlayCanvas,
        setMinimapCanvas,
        setMinimapOverlayCanvas,
      }}
    >
      {children}
    </CanvasContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCanvasContext(): CanvasState {
  const ctx = useContext(CanvasContext);
  if (!ctx)
    throw new Error("useCanvasContext must be used inside <CanvasProvider>");
  return ctx;
}
