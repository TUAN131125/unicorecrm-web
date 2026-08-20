import { BrowserStorageAdapter, type StoragePort } from "@/platform/persistence";
import { getWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { createWorkspaceScopedRepository } from "@/platform/workspace-scope/createWorkspaceScopedRepository";
import { WorkspaceScopedStorageAdapter } from "@/platform/workspace-scope/WorkspaceScopedStorageAdapter";

export type NotificationCategory = "work" | "care" | "system";
export type NotificationPriority = "low" | "medium" | "high" | "urgent";

export interface NotificationEntityRef {
  moduleKey: string;
  recordId: string;
  label?: string;
}

export interface NotificationRecord {
  id: string;
  workspaceId: string;
  recipientMemberId: string;
  category: NotificationCategory;
  type: string;
  title: string;
  message: string;
  priority: NotificationPriority;
  createdAt: string;
  readAt?: string;
  entityRef?: NotificationEntityRef;
  route?: string;
  sourceEventId?: string;
  dedupeKey?: string;
}

export interface PublishNotificationInput extends Omit<NotificationRecord, "workspaceId" | "createdAt" | "readAt"> {
  workspaceId?: string;
  createdAt?: string;
}

class NotificationRepository {
  private records: NotificationRecord[];
  private readonly listeners = new Set<(records: NotificationRecord[]) => void>();

  constructor(private readonly storage: StoragePort) {
    this.records = structuredClone(storage.get<NotificationRecord[]>("records") ?? []);
  }

  list(): NotificationRecord[] {
    return structuredClone(this.records).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  publish(input: PublishNotificationInput): NotificationRecord {
    if (input.dedupeKey) {
      const existing = this.records.find((record) => record.dedupeKey === input.dedupeKey);
      if (existing) return structuredClone(existing);
    }
    const record: NotificationRecord = {
      ...input,
      workspaceId: input.workspaceId ?? getWorkspaceContextSnapshot().workspaceId,
      createdAt: input.createdAt ?? new Date().toISOString(),
    };
    this.records = [record, ...this.records.filter((item) => item.id !== record.id)];
    this.commit();
    return structuredClone(record);
  }

  markRead(id: string, read: boolean): void {
    const now = new Date().toISOString();
    this.records = this.records.map((record) => record.id === id ? { ...record, readAt: read ? now : undefined } : record);
    this.commit();
  }

  markAllRead(recipientMemberId: string): void {
    const now = new Date().toISOString();
    this.records = this.records.map((record) => record.recipientMemberId === recipientMemberId && !record.readAt ? { ...record, readAt: now } : record);
    this.commit();
  }

  subscribe(listener: (records: NotificationRecord[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private commit(): void {
    this.storage.set("records", this.records);
    const snapshot = this.list();
    this.listeners.forEach((listener) => listener(snapshot));
  }
}

const storage = new BrowserStorageAdapter();
const notificationRepository = createWorkspaceScopedRepository({
  resourceKey: "notifications",
  authorizeReads: false,
  createRepository: (workspaceId) => new NotificationRepository(new WorkspaceScopedStorageAdapter(storage, workspaceId, "notifications")),
});

export const getNotificationsSnapshot = (): NotificationRecord[] => notificationRepository.list();
export const subscribeToNotifications = (listener: (records: NotificationRecord[]) => void): (() => void) => notificationRepository.subscribe(listener);
export const publishNotification = (input: PublishNotificationInput): NotificationRecord => notificationRepository.publish(input);
export const markNotificationRead = (id: string): void => notificationRepository.markRead(id, true);
export const markNotificationUnread = (id: string): void => notificationRepository.markRead(id, false);
export const markAllNotificationsRead = (recipientMemberId: string): void => notificationRepository.markAllRead(recipientMemberId);

export type OrderToCashEventType =
  | "OrderCreated" | "OrderConfirmationRequested" | "OrderConfirmed" | "OrderChanged" | "OrderCancelled" | "OrderCompleted"
  | "PaymentRequestCreated" | "PaymentRequestSent" | "PaymentRequestExpired" | "PaymentSucceeded" | "PaymentFailed" | "PaymentRecorded" | "PaymentAllocated" | "RefundSucceeded"
  | "InvoiceIssued" | "InvoiceIssueFailed" | "InvoiceSent" | "InvoiceDueSoon" | "InvoiceOverdue" | "ReceivablePaid" | "CreditNoteIssued"
  | "ShippingBooked" | "ShippingInTransit" | "ShippingDelivered" | "ShippingException" | "CodCollected" | "CodRemitted";

export type CustomerCommunicationChannel = "IN_APP" | "EMAIL" | "SMS" | "ZALO" | "WEBHOOK" | "CUSTOMER_PORTAL";
export type CustomerCommunicationState = "QUEUED" | "SENDING" | "SENT" | "FAILED" | "CANCELLED";

export interface CustomerCommunicationRecord {
  id: string;
  workspaceId: string;
  event: OrderToCashEventType;
  entityRef: NotificationEntityRef;
  recipient: string;
  channel: CustomerCommunicationChannel;
  templateKey: string;
  locale: "vi" | "en";
  subject: string;
  body: string;
  state: CustomerCommunicationState;
  attempts: number;
  retryable: boolean;
  failureCode?: string;
  correlationId: string;
  dedupeKey?: string;
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
  version: number;
}

export interface RecordCustomerCommunicationInput extends Omit<CustomerCommunicationRecord, "workspaceId" | "attempts" | "createdAt" | "updatedAt" | "version"> {
  workspaceId?: string;
  attempts?: number;
  createdAt?: string;
}

class CustomerCommunicationRepository {
  private records: CustomerCommunicationRecord[];
  private readonly listeners = new Set<(records: CustomerCommunicationRecord[]) => void>();

  constructor(private readonly storage: StoragePort) {
    this.records = structuredClone(storage.get<CustomerCommunicationRecord[]>("records") ?? []);
  }

  list(entityRef?: NotificationEntityRef): CustomerCommunicationRecord[] {
    return structuredClone(this.records)
      .filter((record) => !entityRef || (record.entityRef.moduleKey === entityRef.moduleKey && record.entityRef.recordId === entityRef.recordId))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  record(input: RecordCustomerCommunicationInput): CustomerCommunicationRecord {
    if (input.dedupeKey) {
      const replay = this.records.find((record) => record.dedupeKey === input.dedupeKey);
      if (replay) return structuredClone(replay);
    }
    const now = input.createdAt ?? new Date().toISOString();
    const record: CustomerCommunicationRecord = {
      ...input,
      workspaceId: input.workspaceId ?? getWorkspaceContextSnapshot().workspaceId,
      attempts: input.attempts ?? (input.state === "QUEUED" ? 0 : 1),
      createdAt: now,
      updatedAt: now,
      sentAt: input.state === "SENT" ? now : input.sentAt,
      version: 1,
    };
    this.records = [record, ...this.records.filter((item) => item.id !== record.id)];
    this.commit();
    return structuredClone(record);
  }

  transition(id: string, input: { expectedVersion: number; state: CustomerCommunicationState; retryable?: boolean; failureCode?: string; now?: string }): CustomerCommunicationRecord {
    const current = this.records.find((record) => record.id === id);
    if (!current) throw new Error(`Customer communication ${id} not found.`);
    if (current.version !== input.expectedVersion) throw new Error("CUSTOMER_COMMUNICATION_VERSION_CONFLICT");
    if (current.state === "CANCELLED" || current.state === "SENT") throw new Error("CUSTOMER_COMMUNICATION_TERMINAL");
    const now = input.now ?? new Date().toISOString();
    const next: CustomerCommunicationRecord = {
      ...current,
      state: input.state,
      retryable: input.retryable ?? current.retryable,
      failureCode: input.failureCode,
      attempts: input.state === "SENDING" ? current.attempts + 1 : current.attempts,
      sentAt: input.state === "SENT" ? now : current.sentAt,
      updatedAt: now,
      version: current.version + 1,
    };
    this.records = this.records.map((record) => record.id === id ? next : record);
    this.commit();
    return structuredClone(next);
  }

  retry(id: string, expectedVersion: number): CustomerCommunicationRecord {
    const current = this.records.find((record) => record.id === id);
    if (!current) throw new Error(`Customer communication ${id} not found.`);
    if (current.state !== "FAILED" || !current.retryable) throw new Error("CUSTOMER_COMMUNICATION_NOT_RETRYABLE");
    return this.transition(id, { expectedVersion, state: "SENDING", retryable: true });
  }

  subscribe(listener: (records: CustomerCommunicationRecord[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private commit(): void {
    this.storage.set("records", this.records);
    const snapshot = this.list();
    this.listeners.forEach((listener) => listener(snapshot));
  }
}

const customerCommunicationRepository = createWorkspaceScopedRepository({
  resourceKey: "customer-communications",
  authorizeReads: false,
  createRepository: (workspaceId) => new CustomerCommunicationRepository(new WorkspaceScopedStorageAdapter(storage, workspaceId, "customer-communications")),
});

export const getCustomerCommunicationsSnapshot = (entityRef?: NotificationEntityRef): CustomerCommunicationRecord[] => customerCommunicationRepository.list(entityRef);
export const subscribeToCustomerCommunications = (listener: (records: CustomerCommunicationRecord[]) => void): (() => void) => customerCommunicationRepository.subscribe(listener);
export const recordCustomerCommunication = (input: RecordCustomerCommunicationInput): CustomerCommunicationRecord => customerCommunicationRepository.record(input);
export const transitionCustomerCommunication = (id: string, input: { expectedVersion: number; state: CustomerCommunicationState; retryable?: boolean; failureCode?: string; now?: string }): CustomerCommunicationRecord => customerCommunicationRepository.transition(id, input);
export const retryCustomerCommunication = (id: string, expectedVersion: number): CustomerCommunicationRecord => customerCommunicationRepository.retry(id, expectedVersion);
