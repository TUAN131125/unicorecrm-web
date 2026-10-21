import { useEffect, useRef, useState } from "react";
import { useEffectiveAccess, useEffectiveRecordAccessDecision } from "@/platform/access-control";
import { useWorkspaceMemberDirectory } from "@/platform/member-directory/useWorkspaceMemberDirectory";
import { createTaskCommand, getTaskApiRuntime, getTaskReadAuthorityScope, type MeetingActivityDraft } from "@/modules/tasks";

export function useOrganizationMeeting(recordId: string, status: string | undefined, refreshWork: () => Promise<unknown>) {
  const access = useEffectiveAccess();
  const record = useEffectiveRecordAccessDecision();
  const directory = useWorkspaceMemberDirectory();
  const liveDirectory = useRef(directory); liveDirectory.current = directory;
  const [intent, setIntent] = useState<string>();
  const liveIntent = useRef<string | undefined>(undefined);
  const pending = useRef(false);
  const request = useRef<AbortController | undefined>(undefined);
  const mounted = useRef(true);
  const canCreate = Boolean(status && status !== "archived" && record?.canRead && access.can("organizations.read")
    && access.can("tasks.create") && getTaskApiRuntime().mode === "connected");
  const live = useRef({ recordId, canCreate });
  live.current = { recordId, canCreate };
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; liveIntent.current = undefined; request.current?.abort(); }; }, []);
  useEffect(() => { if (!canCreate) { liveIntent.current = undefined; request.current?.abort(); setIntent(undefined); } }, [canCreate]);
  const close = () => { liveIntent.current = undefined; request.current?.abort(); setIntent(undefined); };
  const open = () => {
    if (!canCreate || pending.current || liveIntent.current) return;
    const next = crypto.randomUUID(); liveIntent.current = next; setIntent(next);
  };
  const save = async (draft: MeetingActivityDraft): Promise<boolean> => {
    const capturedIntent = liveIntent.current;
    const authority = getTaskReadAuthorityScope();
    const currentDirectory = liveDirectory.current;
    const assignee = currentDirectory.status === "ready" ? currentDirectory.members.find(member => member.memberId === draft.owner) : undefined;
    const due = new Date(draft.startAt);
    if (!canCreate || !capturedIntent || pending.current || !authority || !assignee || !Number.isFinite(due.getTime())) return false;
    const controller = new AbortController(); request.current = controller; pending.current = true;
    const owns = () => mounted.current && liveIntent.current === capturedIntent && live.current.recordId === recordId
      && live.current.canCreate && !controller.signal.aborted && getTaskReadAuthorityScope() === authority;
    try {
      const outcome = await createTaskCommand({
        id: `task_organization_meeting_${capturedIntent}`, title: draft.title,
        description: [draft.agenda, draft.channel, draft.location, draft.attendees, draft.endAt].filter(Boolean).join(" Â· "),
        priority: "HIGH", assigneeId: assignee.memberId, actorId: assignee.memberId, dueAt: due.toISOString(),
        recordRef: { moduleKey: "organizations", recordId }, sourceRef: { type: "ORGANIZATION_MEETING", id: recordId },
      }, { idempotencyKey: `task.create:organization-meeting:${capturedIntent}`, correlationId: `organization:${recordId}` }, { signal: controller.signal });
      if (!owns() || outcome.data.recordRef?.moduleKey !== "organizations" || outcome.data.recordRef.recordId !== recordId
        || !["COMMITTED", "REPLAYED"].includes(outcome.outcome ?? "")) return false;
      await refreshWork();
      return owns();
    } finally { pending.current = false; if (request.current === controller) request.current = undefined; }
  };
  return { canCreate, isOpen: Boolean(intent) && canCreate, open, close, save };
}
