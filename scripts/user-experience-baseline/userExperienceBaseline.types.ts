export type ExperiencePriority = "P0" | "P1" | "P2";
export type BaselineState = "CAPTURED" | "VERIFIED";
export type DeliveryState = "NOT_STARTED" | "IN_PROGRESS" | "ACCEPTED";

export interface ExperienceBacklogItem {
  id: `${ExperiencePriority}-${string}`;
  priority: ExperiencePriority;
  title: string;
  problem: string;
  routeKeys: string[];
  domainOwners: string[];
  acceptanceCriteria: string[];
  verificationCommands: string[];
  evidenceRequired: string[];
  baselineState: BaselineState;
  deliveryState: DeliveryState;
}

export type PilotActorRole =
  | "SALES"
  | "SALES_MANAGER"
  | "FINANCE"
  | "OPERATIONS"
  | "WORKSPACE_ADMIN"
  | "PRODUCT_ENGINEERING";

export interface PilotActor {
  id: string;
  memberId: string;
  role: PilotActorRole;
}

export type PilotRecordKind =
  | "lead"
  | "contact"
  | "organization"
  | "deal"
  | "quote"
  | "order"
  | "payment"
  | "shipping"
  | "return"
  | "support"
  | "task";

export interface PilotRecord {
  id: string;
  kind: PilotRecordKind;
  ownerId: string;
  customerRelationshipId: string;
  links: Record<string, string>;
}

export interface PilotJourneyStep {
  id: string;
  sequence: number;
  actorRole: PilotActorRole;
  routeKey: string;
  recordIds: string[];
  expectedEvidence: string[];
}

export interface PilotMetricDefinition {
  id: string;
  label: string;
  unit: "duration" | "rate" | "count" | "currency-delta";
  sourceRecordKinds: PilotRecordKind[];
  dimensions: string[];
  evidenceOwner: string;
}
