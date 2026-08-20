export type ConfigurationLocalizedText = { vi: string; en: string };

export type ConfigurationFieldDataType =
  | "TEXT"
  | "NUMBER"
  | "CURRENCY"
  | "DATE"
  | "CHECKBOX"
  | "SELECT"
  | "MULTI_SELECT"
  | "RELATIONSHIP";

export interface RuntimeFieldDefinition {
  key: string;
  objectType: string;
  origin: "SYSTEM" | "CUSTOM" | "DERIVED";
  dataType: ConfigurationFieldDataType;
  labels: ConfigurationLocalizedText;
  required: boolean;
  readOnly?: boolean;
  hidden?: boolean;
  options?: Array<{ value: string; labels: ConfigurationLocalizedText }>;
  validation?: {
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
  };
  searchable: boolean;
  filterable: boolean;
  sortable: boolean;
  exportable: boolean;
  status: "ACTIVE" | "INACTIVE" | "DEPRECATED";
}

export interface RuntimeObjectSchema {
  objectType: string;
  labels: ConfigurationLocalizedText;
  fields: RuntimeFieldDefinition[];
  version: number;
}

export interface RuntimeFormFieldPlacement {
  fieldKey: string;
  required?: boolean;
  readOnly?: boolean;
  hidden?: boolean;
  columnSpan?: 1 | 2;
  visibilityCondition?: {
    fieldKey: string;
    operator: "EQUALS" | "NOT_EQUALS" | "HAS_VALUE";
    value?: string;
  };
}

export interface RuntimeFormSection {
  id: string;
  labels: ConfigurationLocalizedText;
  columns: 1 | 2;
  fields: RuntimeFormFieldPlacement[];
}

export interface RuntimeBusinessForm {
  id: string;
  objectType: string;
  context: "CREATE" | "EDIT" | "QUICK_CREATE" | "TRANSITION";
  roleScope?: string[];
  sections: RuntimeFormSection[];
  version: number;
  status: "DRAFT" | "EFFECTIVE" | "RETIRED";
}

export interface RuntimeViewPolicy {
  id: string;
  objectType: string;
  roleId?: string;
  allowedColumns: string[];
  requiredColumns: string[];
  defaultColumns: string[];
  defaultSort?: { field: string; direction: "asc" | "desc" };
  version: number;
}

export interface RuntimeUserViewPreference {
  objectType: string;
  visibleColumns: string[];
  columnOrder?: string[];
  columnWidths?: Record<string, number>;
  pinnedColumns?: string[];
  sort?: { field: string; direction: "asc" | "desc" };
  pageSize?: number;
  customizedAt: string;
}

export interface EffectiveViewResult {
  visibleColumns: string[];
  source: "USER" | "ROLE" | "WORKSPACE";
  removedColumns: string[];
}


export interface RuntimeReceivableConfiguration { gracePeriodDays: number; agingBuckets: number[]; reminderScheduleDays: number[]; escalationScheduleDays: number[]; collectionOwnerRule: "ORDER_OWNER" | "FINANCE_QUEUE" | "MANUAL"; promiseToPayEnabled: boolean; disputeStatuses: string[]; customerCreditPolicy: "ALLOW" | "REQUIRE_REFUND"; overpaymentPolicy: "CUSTOMER_CREDIT" | "REQUIRE_REFUND"; writeOffThreshold: number; statementTemplateKey: string; }
export interface RuntimeReasonCatalog { catalog: string; entries: Array<{ code: string; labelVi: string; labelEn: string; enabled: boolean; noteRequired: boolean; evidenceRequired: boolean; requiredCapability?: string }> }

export interface CrmConfiguration {
  revision: number;
  objectSchemas: RuntimeObjectSchema[];
  businessForms: RuntimeBusinessForm[];
  workspaceViewPolicies: RuntimeViewPolicy[];
  roleViewPolicies: RuntimeViewPolicy[];
  receivableConfiguration: RuntimeReceivableConfiguration;
  reasonCatalogs: RuntimeReasonCatalog[];
}
