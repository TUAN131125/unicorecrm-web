import { useEffect, useState } from "react";
import { getTaskApiRuntime } from "@/modules/tasks";
import { useEffectiveAccess, useEffectiveRecordAccessDecision } from "@/platform/access-control";
import type { RelationshipPanelMode } from "@/components/crm/relationship-panel/RelationshipWorkPanelShell";
import { useCustomerPanelData } from "./useCustomerPanelData";
import { useCustomerMeeting } from "./useCustomerMeeting";

/** One authority-scoped work/history session shared by the main tab and side panel. */
export function useCustomerWorkController(customerId: string, status: string | undefined, enabled: boolean) {
  const access = useEffectiveAccess();
  const record = useEffectiveRecordAccessDecision();
  const [mode, setMode] = useState<RelationshipPanelMode>("WORK");
  const [selectedId, setSelectedId] = useState<string>();
  const [taskOpen, setTaskOpen] = useState(false);
  const [taskCreated, setTaskCreated] = useState(false);
  const data = useCustomerPanelData(customerId, mode === "HISTORY", enabled);
  const meeting = useCustomerMeeting(customerId, status, data.taskEntry.refresh);
  const canCreateTask = Boolean(record?.canRead && access.can("customers.view") && access.canPerform("tasks", "create")
    && status && ["NEW", "ACTIVE", "INACTIVE"].includes(status) && getTaskApiRuntime().mode === "connected");
  useEffect(() => { setSelectedId(undefined); setTaskOpen(false); setTaskCreated(false); }, [customerId]);
  useEffect(() => { if (!enabled || !data.historySupported || !data.readable) setSelectedId(undefined); }, [enabled, data.historySupported, data.readable]);
  return { data, mode, setMode: (value: RelationshipPanelMode) => { setMode(value); setSelectedId(undefined); },
    canCreateTask, taskOpen, closeTask: () => setTaskOpen(false),
    openTask: () => { if (canCreateTask) { setTaskCreated(false); setTaskOpen(true); } },
    taskCreated, onTaskCreated: () => { setTaskCreated(true); void data.taskEntry.refresh(); },
    selected: enabled ? data.historyItems.find(item => item.id === selectedId) : undefined,
    selectActivity: setSelectedId, meeting };
}

export type CustomerWorkController = ReturnType<typeof useCustomerWorkController>;
