import React from "react";

export interface OverlayLayer {
  scope: "page" | "modal";
  baseZIndex: number;
}

const DEFAULT_OVERLAY_LAYER: OverlayLayer = { scope: "page", baseZIndex: 2980 };

export const OverlayLayerContext = React.createContext<OverlayLayer>(DEFAULT_OVERLAY_LAYER);
export const OverlayLayerProvider = OverlayLayerContext.Provider;

export function useOverlayLayer(): OverlayLayer {
  return React.useContext(OverlayLayerContext);
}
