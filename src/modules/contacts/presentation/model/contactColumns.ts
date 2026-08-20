export interface ContactColumnDefinition {
  key: string;
  labelKey: string;
  isSortable?: boolean;
  align?: "left" | "center" | "right";
  defaultVisible?: boolean;
  minWidth?: number;
}

export const CONTACT_COLUMNS_METADATA: ContactColumnDefinition[] = [
  { key: "code", labelKey: "contactColumns.code", isSortable: true, defaultVisible: true, minWidth: 100 },
  { key: "fullName", labelKey: "contactColumns.fullName", isSortable: true, defaultVisible: true, minWidth: 180 },
  { key: "title", labelKey: "contactColumns.title", isSortable: true, defaultVisible: true, minWidth: 140 },
  { key: "mobilePhone", labelKey: "contactColumns.mobilePhone", isSortable: true, defaultVisible: true, minWidth: 130 },
  { key: "workPhone", labelKey: "contactColumns.workPhone", isSortable: true, defaultVisible: false, minWidth: 130 },
  { key: "workEmail", labelKey: "contactColumns.workEmail", isSortable: true, defaultVisible: true, minWidth: 185 },
  { key: "personalEmail", labelKey: "contactColumns.personalEmail", isSortable: true, defaultVisible: false, minWidth: 185 },
  { key: "zalo", labelKey: "contactColumns.zalo", defaultVisible: false, minWidth: 120 },
  { key: "companyName", labelKey: "contactColumns.companyName", isSortable: true, defaultVisible: true, minWidth: 180 },
  { key: "status", labelKey: "contactColumns.status", isSortable: true, defaultVisible: true, minWidth: 140 },
  { key: "relationshipLevel", labelKey: "contactColumns.relationshipLevel", isSortable: true, defaultVisible: true, minWidth: 130 },
  { key: "decisionRole", labelKey: "contactColumns.decisionRole", isSortable: true, defaultVisible: true, minWidth: 130 },
  { key: "ownerId", labelKey: "contactColumns.ownerId", isSortable: true, defaultVisible: true, minWidth: 130 },
  { key: "source", labelKey: "contactColumns.source", isSortable: true, defaultVisible: false, minWidth: 130 },
  { key: "lastInteractionAt", labelKey: "contactColumns.lastInteractionAt", isSortable: true, defaultVisible: true, minWidth: 150 },
  { key: "nextFollowUpAt", labelKey: "contactColumns.nextFollowUpAt", isSortable: true, defaultVisible: true, minWidth: 150 },
  { key: "openOpportunityCount", labelKey: "contactColumns.openOpportunityCount", isSortable: true, defaultVisible: false, minWidth: 120 },
  { key: "tags", labelKey: "contactColumns.tags", defaultVisible: true, minWidth: 150 }
];
