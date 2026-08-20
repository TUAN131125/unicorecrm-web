export interface ConfiguredProductType {
  id: string;
  code: string;
  displayNameVi: string;
  displayNameEn: string;
  descriptionVi?: string;
  descriptionEn?: string;
  status: "active" | "inactive";
  canBeQuoted: boolean;
  canBeSold: boolean;
  createsOwnedProduct: boolean;
  hasWarranty: boolean;
  hasSLA: boolean;
  hasSubscriptionPeriod: boolean;
  canBeRenewed: boolean;
  requiresStartDate: boolean;
  requiresEndDate: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ConfiguredProductField {
  id: string;
  fieldKey: string;
  labelVi: string;
  labelEn: string;
  type: "text" | "number" | "currency" | "date" | "select" | "boolean" | "textarea";
  appliesToProductTypes: string[];
  required: boolean;
  visible: boolean;
  placeholderVi?: string;
  placeholderEn?: string;
  helpTextVi?: string;
  helpTextEn?: string;
  options?: string[];
  displayOrder: number;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
}
