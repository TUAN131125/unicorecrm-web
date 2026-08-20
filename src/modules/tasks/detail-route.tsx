import React from "react";
import { useParams } from "react-router-dom";
import { useSubscribableSnapshot } from "@/platform/react";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { EFFECTIVE_RECORD_ACCESS_PROFILES, EffectiveRecordAccessBoundary } from "@/platform/access-control";
import { AuthoritativeQueryBoundary, useModuleAuthoritativeResource } from "@/shared/operations";
import { getActivityCollectionResource, getTaskDetailResource } from "./application/vertical-slice/taskAuthoritativeQueries";
import { getRetainedTaskActivitySnapshot, replaceTaskActivitySnapshot, subscribeToTaskActivity } from "./public/api";
import { TaskDetailPage as TaskDetailScreen } from "./presentation/pages/TaskDetailPage";

const TaskDetailContent: React.FC = () => {
  const { taskId = "" } = useParams();
  const workspace = useWorkspaceContextSnapshot();
  const detailQuery = useModuleAuthoritativeResource(getTaskDetailResource(taskId || "__missing__"), {
    enabled: Boolean(taskId),
    scopeKey: workspace.workspaceId,
    onScopeChange: () => replaceTaskActivitySnapshot({ tasks: [], activities: [] }),
  });
  const snapshot = useSubscribableSnapshot(getRetainedTaskActivitySnapshot, subscribeToTaskActivity);
  const task = snapshot.tasks.find((item) => item.id === taskId);
  const recordRef = task?.recordRef;
  const activityQuery = useModuleAuthoritativeResource(getActivityCollectionResource({
    filters: {
      recordModuleKey: recordRef?.moduleKey ?? "__unresolved__",
      recordId: recordRef?.recordId ?? "__unresolved__",
    },
  }), {
    enabled: Boolean(recordRef?.moduleKey && recordRef.recordId),
    scopeKey: workspace.workspaceId,
    onScopeChange: () => replaceTaskActivitySnapshot({ tasks: [], activities: [] }),
  });
  const hasRelatedActivityData = !recordRef || snapshot.activities.some((activity) =>
    activity.recordRef?.moduleKey === recordRef.moduleKey && activity.recordRef?.recordId === recordRef.recordId,
  );

  return (
    <AuthoritativeQueryBoundary
      query={detailQuery}
      hasData={snapshot.tasks.some((item) => item.id === taskId)}
      loadingTitleVi="Đang tải công việc từ backend"
      loadingTitleEn="Loading task from backend"
      errorTitleVi="Không thể tải công việc"
      errorTitleEn="Task could not be loaded"
    >
      <AuthoritativeQueryBoundary
        query={activityQuery}
        hasData={hasRelatedActivityData}
        loadingTitleVi="Đang tải hoạt động liên quan từ backend"
        loadingTitleEn="Loading related activity from backend"
        errorTitleVi="Không thể tải hoạt động liên quan"
        errorTitleEn="Related activity could not be loaded"
      >
        <TaskDetailScreen />
      </AuthoritativeQueryBoundary>
    </AuthoritativeQueryBoundary>
  );
};

export const TaskDetailPage: React.FC = () => {
  const { taskId = "" } = useParams();
  return (
    <EffectiveRecordAccessBoundary resourceKey="tasks" recordId={taskId} {...EFFECTIVE_RECORD_ACCESS_PROFILES.tasks}>
      <TaskDetailContent />
    </EffectiveRecordAccessBoundary>
  );
};
