import React from "react";

// Opt-in owners may quarantine mounted drafts without moving their portal identity.
export type OverlayDraftRecovery = { canDiscard(): boolean; discard(): void };
export const OverlayPortalHostContext = React.createContext<{ container: HTMLElement; suspended: boolean; registerDraft?: (draft: OverlayDraftRecovery) => () => void } | undefined>(undefined);
