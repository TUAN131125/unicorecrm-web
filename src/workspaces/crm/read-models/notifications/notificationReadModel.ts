import type { NotificationRecord } from "@/platform/notifications";

export type CRMNotification = NotificationRecord;

export function getUnreadNotificationCount(notifications: readonly CRMNotification[]): number {
  return notifications.filter((notification) => !notification.readAt).length;
}

/**
 * CRM status snapshots no longer synthesize notifications.
 * Notifications are persisted recipient events created by business commands.
 */
export function buildNotificationsFromCRMData(): CRMNotification[] {
  return [];
}
