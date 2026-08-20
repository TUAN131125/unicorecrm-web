import { useCallback, useMemo } from "react";
import {
  getNotificationsSnapshot,
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationUnread,
  subscribeToNotifications,
} from "@/platform/notifications";
import { getAuthSessionSnapshot } from "@/platform/identity-auth";
import { useSubscribableSnapshot } from "@/platform/react";

export function useNotificationsReadModel() {
  const snapshot = useSubscribableSnapshot(getNotificationsSnapshot, subscribeToNotifications);
  const currentMemberId = getAuthSessionSnapshot()?.principal.memberId;
  const notifications = useMemo(
    () => currentMemberId ? snapshot.filter((notification) => notification.recipientMemberId === currentMemberId) : [],
    [currentMemberId, snapshot],
  );

  return {
    notifications,
    markRead: useCallback((id: string) => markNotificationRead(id), []),
    markUnread: useCallback((id: string) => markNotificationUnread(id), []),
    markAllRead: useCallback(() => {
      if (currentMemberId) markAllNotificationsRead(currentMemberId);
    }, [currentMemberId]),
  };
}
