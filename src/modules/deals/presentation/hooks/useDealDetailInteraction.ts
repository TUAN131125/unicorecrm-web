import React, { useState } from "react";
import type { Deal } from "../../domain/model/deal.types";
import { createDurableId } from "@/shared/ids";
import { getWorkspaceContextSnapshot, useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { getDirtyUnsavedWork, registerUnsavedWork } from "@/platform/unsaved-work";
import { requestDecision } from "@/components/feedback/ProductDialogService";

export function useDealDetailInteraction(screenDeal: Deal | undefined, dealId: string | undefined,
  lostDirty: boolean, locale: string, resetDraft: () => void, saveLost: () => Promise<boolean>, onError: (error: unknown) => void) {
  const workspace = useWorkspaceContextSnapshot();
  const liveRoute = React.useRef(dealId); liveRoute.current = dealId;
  const openingWorkspace = React.useRef(workspace.workspaceId);
  const [openingDeal, setOpeningDeal] = useState<Deal>();
  const pendingMutation = React.useRef(false);
  const active = React.useRef(false);
  const mounted = React.useRef(true);
  const interactionCycle = React.useRef(0);
  const intentId = React.useRef(createDurableId("deal-detail"));
  const [interactionPending, setInteractionPending] = useState(false);
  React.useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [isWonModalOpen, setWonOpen] = useState(false);
  const [isProductPickerOpen, setProductPickerOpen] = useState(false);
  const [isLostModalOpen, setLostOpen] = useState(false);
  const [isDirectNoteModalOpen, setDirectNoteOpen] = useState(false);
  const interactionOpen = isWonModalOpen || isLostModalOpen || isProductPickerOpen || isDirectNoteModalOpen;
  const resetInteraction = () => {
    if (pendingMutation.current || !mounted.current) return;
    interactionCycle.current += 1;
    active.current = false;
    setWonOpen(false); setLostOpen(false); setProductPickerOpen(false); setDirectNoteOpen(false);
    resetDraft();
    setOpeningDeal(undefined);
  };
  const openInteraction = (setter: React.Dispatch<React.SetStateAction<boolean>>, value: boolean) => {
    if (pendingMutation.current) return;
    if (value) {
      if (active.current || !screenDeal) return;
      active.current = true;
      openingWorkspace.current = getWorkspaceContextSnapshot().workspaceId;
      interactionCycle.current += 1;
      intentId.current = createDurableId("deal-detail");
      setOpeningDeal(structuredClone(screenDeal));
      setter(true);
    } else if (setter === setLostOpen && lostDirty) {
      const cycle = interactionCycle.current;
      void requestDecision({ title: locale === "vi" ? "Bỏ thay đổi chưa lưu?" : "Discard unsaved changes?",
        message: locale === "vi" ? "Các thay đổi chưa được lưu." : "Your changes have not been saved.", tone: "warning",
        actions: [{id:"keep",label:locale === "vi" ? "Tiếp tục chỉnh sửa" : "Keep editing",variant:"secondary"},
          {id:"discard",label:locale === "vi" ? "Bỏ thay đổi" : "Discard changes",variant:"danger"}],
      }).then(decision => { if (decision === "discard" && mounted.current && !pendingMutation.current && interactionCycle.current === cycle) resetInteraction(); });
    } else resetInteraction();
  };
  const setIsWonModalOpen = (value: boolean) => openInteraction(setWonOpen, value);
  const setIsLostModalOpen = (value: boolean) => openInteraction(setLostOpen, value);
  const setIsProductPickerOpen = (value: boolean) => openInteraction(setProductPickerOpen, value);
  const setIsDirectNoteModalOpen = (value: boolean) => openInteraction(setDirectNoteOpen, value);
  React.useEffect(() => {
    if (interactionOpen && workspace.workspaceId !== openingWorkspace.current && !lostDirty && !pendingMutation.current && getDirtyUnsavedWork().length === 0) resetInteraction();
    if (openingDeal && dealId !== openingDeal.id && !lostDirty && !pendingMutation.current && !isDirectNoteModalOpen && !isProductPickerOpen) resetInteraction();
  });
  React.useEffect(() => {
    if (!interactionOpen) return;
    const cycle = interactionCycle.current;
    const unregister = registerUnsavedWork({ id: `deal-detail:${openingDeal?.id}:${cycle}`,
      title: openingDeal?.name ?? "Deal", isDirty: lostDirty || interactionPending,
      save: async () => !mounted.current || pendingMutation.current || interactionCycle.current !== cycle || !isLostModalOpen || getWorkspaceContextSnapshot().workspaceId !== openingWorkspace.current ? false : saveLost(),
      canDiscard: () => !pendingMutation.current && mounted.current && interactionCycle.current === cycle,
      discard: resetInteraction,
    });
    const warn = (event: BeforeUnloadEvent) => { if (lostDirty || pendingMutation.current) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => { unregister(); window.removeEventListener("beforeunload", warn); };
  });
  const runBoundMutation = async (run: () => Promise<unknown>, propagateError = false): Promise<boolean> => {
    if (pendingMutation.current || !mounted.current || (openingDeal && liveRoute.current !== openingDeal.id) || getWorkspaceContextSnapshot().workspaceId !== openingWorkspace.current) return false;
    const cycle = interactionCycle.current;
    pendingMutation.current = true;
    setInteractionPending(true);
    try { const result = await run(); return result !== false && mounted.current && interactionCycle.current === cycle && (!openingDeal || liveRoute.current === openingDeal.id) && getWorkspaceContextSnapshot().workspaceId === openingWorkspace.current; }
    catch (error) {
      if (mounted.current && interactionCycle.current === cycle) {
        onError(error);
      }
      if (propagateError) throw error;
      return false;
    } finally {
      if (mounted.current && interactionCycle.current === cycle) { pendingMutation.current = false; setInteractionPending(false); }
    }
  };
  return { intentId: intentId.current, openingDeal, pendingMutation, interactionPending, resetInteraction, runBoundMutation,
    isWonModalOpen, setIsWonModalOpen, isLostModalOpen, setIsLostModalOpen,
    isProductPickerOpen, setIsProductPickerOpen, isDirectNoteModalOpen, setIsDirectNoteModalOpen };
}
