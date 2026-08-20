export type ReceivableCollectionActivityType =
  | "COLLECTION_NOTE"
  | "PAYMENT_REQUEST"
  | "REMINDER_SENT"
  | "STATEMENT_SENT"
  | "PROMISE_TO_PAY"
  | "DISPUTE_OPENED"
  | "DISPUTE_RESOLVED"
  | "OWNER_ASSIGNED"
  | "CREDIT_HOLD_APPLIED"
  | "CREDIT_HOLD_RELEASED"
  | "ESCALATED"
  | "WRITE_OFF_PROPOSED";

export interface ReceivableCollectionActivity {
  id: string;
  workspaceId: string;
  invoiceId?: string;
  buyerId: string;
  type: ReceivableCollectionActivityType;
  note: string;
  ownerId?: string;
  dueAt?: string;
  channel?: "IN_APP" | "EMAIL" | "SMS" | "ZALO" | "PHONE" | "OTHER";
  reasonCode?: string;
  state: "OPEN" | "COMPLETED" | "CANCELLED";
  createdAt: string;
  createdBy: string;
}

export interface ReceivableOperationsPort {
  list(filter?: { invoiceId?: string; buyerId?: string }): ReceivableCollectionActivity[];
  save(input: Omit<ReceivableCollectionActivity, "id" | "workspaceId" | "createdAt"> & Partial<Pick<ReceivableCollectionActivity, "id" | "createdAt">>): ReceivableCollectionActivity;
  updateState(activityId: string, state: ReceivableCollectionActivity["state"]): ReceivableCollectionActivity;
  subscribe(listener: (snapshot: ReceivableCollectionActivity[]) => void): () => void;
}
