export const OVERLAY_Z = {
  pagePanel: "z-[1000]",
  stickyHeader: "z-[2000]",
  dropdown: "z-[3000]",
  popover: "z-[3500]",
  drawerBackdrop: "z-[6500]",
  drawer: "z-[7000]",
  modalBackdrop: "z-[8900]",
  modal: "z-[9000]",
  toast: "z-[9500]",
  emergency: "z-[9999]",
} as const;

export type OverlayLayerKey = keyof typeof OVERLAY_Z;
