import {
  assertConfigurationOperationAvailable,
  CRM_OBJECT_SCHEMA_SAVE_OPERATION,
} from "@/platform/connected-configuration/connectedConfigurationAvailability";
import { BrowserStorageAdapter, type StoragePort } from "@/platform/persistence";
import { createWorkspaceScopedRepository, WorkspaceScopedStorageAdapter } from "@/platform/workspace-scope";
import type { CrmConfiguration, EffectiveViewResult, RuntimeBusinessForm, RuntimeObjectSchema, RuntimeUserViewPreference, RuntimeViewPolicy } from "./types";

const objectLabels: Array<[string, string, string]> = [
  ["lead", "Khách hàng tiềm năng", "Lead"], ["customer", "Khách hàng", "Customer"], ["contact", "Liên hệ", "Contact"], ["deal", "Cơ hội", "Deal"], ["product", "Sản phẩm", "Product"], ["order", "Đơn hàng", "Order"], ["payment", "Thanh toán", "Payment"], ["invoice", "Hóa đơn", "Invoice"], ["shipment", "Vận chuyển", "Shipment"], ["return", "Trả hàng", "Return"],
];

const defaults = (): CrmConfiguration => ({ revision: 1, objectSchemas: objectLabels.map(([objectType, vi, en]) => ({ objectType, labels: { vi, en }, fields: [], version: 1 })), businessForms: [], workspaceViewPolicies: [], roleViewPolicies: [], receivableConfiguration: { gracePeriodDays: 0, agingBuckets: [30, 60, 90], reminderScheduleDays: [0, 7, 15, 30], escalationScheduleDays: [15, 30, 60], collectionOwnerRule: "ORDER_OWNER", promiseToPayEnabled: true, disputeStatuses: ["OPEN", "RESOLVED"], customerCreditPolicy: "ALLOW", overpaymentPolicy: "CUSTOMER_CREDIT", writeOffThreshold: 0, statementTemplateKey: "statement-default" }, reasonCatalogs: [] });

interface CrmConfigurationRepository {
  getSnapshot(): CrmConfiguration;
  saveObjectSchemas(value: RuntimeObjectSchema[]): CrmConfiguration;
  subscribe(listener: () => void): () => void;
}

class BrowserCrmConfigurationRepository implements CrmConfigurationRepository {
  private readonly listeners = new Set<() => void>();
  private current: CrmConfiguration;

  constructor(private readonly storage: StoragePort) {
    this.current = structuredClone(storage.get<CrmConfiguration>("crm-configuration") ?? defaults());
  }

  getSnapshot(): CrmConfiguration {
    // useSyncExternalStore requires referentially stable snapshots until the store changes.
    return this.current;
  }

  saveObjectSchemas(value: RuntimeObjectSchema[]): CrmConfiguration {
    this.current = {
      ...this.current,
      revision: this.current.revision + 1,
      objectSchemas: structuredClone(value),
    };
    this.storage.set("crm-configuration", this.current);
    this.listeners.forEach((listener) => listener());
    return this.current;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

const storage = new BrowserStorageAdapter();
const repository = createWorkspaceScopedRepository<CrmConfigurationRepository>({ resourceKey: "crm_configuration", authorizeReads: false, createRepository: (workspaceId) => new BrowserCrmConfigurationRepository(new WorkspaceScopedStorageAdapter(storage, workspaceId, "crm-configuration")) });

export const getConfigurationRuntimeSnapshot = (): CrmConfiguration => repository.getSnapshot();
/**
 * Object-schema writes are browser-persisted. `listCrmObjectSchemas` is READY while
 * `createCrmObjectField` / `updateCrmObjectField` / `deleteCrmObjectField` are all BLOCKED,
 * so connected mode must not write the schema locally. Reads stay available.
 */
export const saveCrmObjectSchemas = (value: RuntimeObjectSchema[]): CrmConfiguration => {
  assertConfigurationOperationAvailable(CRM_OBJECT_SCHEMA_SAVE_OPERATION);
  return repository.saveObjectSchemas(value);
};
export const subscribeToConfigurationRuntime = (listener: () => void): (() => void) => repository.subscribe(listener);
export const getObjectSchema = (objectType: string): RuntimeObjectSchema | undefined => repository.getSnapshot().objectSchemas.find((schema) => schema.objectType === objectType);

export function getBusinessForm(objectType: string, context: RuntimeBusinessForm["context"], roleIds: readonly string[] = []): RuntimeBusinessForm | undefined {
  const candidates = repository.getSnapshot().businessForms.filter((form) => form.objectType === objectType && form.context === context && form.status === "EFFECTIVE").sort((left, right) => right.version - left.version);
  return candidates.find((form) => form.roleScope?.some((roleId) => roleIds.includes(roleId))) ?? candidates.find((form) => !form.roleScope?.length);
}

export const getWorkspaceViewPolicy = (objectType: string): RuntimeViewPolicy | undefined => repository.getSnapshot().workspaceViewPolicies.find((policy) => policy.objectType === objectType);
export const getRoleViewPolicy = (objectType: string, roleIds: readonly string[]): RuntimeViewPolicy | undefined => repository.getSnapshot().roleViewPolicies.find((policy) => policy.objectType === objectType && policy.roleId && roleIds.includes(policy.roleId));

export function resolveEffectiveView(input: { workspacePolicy: RuntimeViewPolicy; rolePolicy?: RuntimeViewPolicy; userPreference?: RuntimeUserViewPreference; permittedColumns?: readonly string[] }): EffectiveViewResult {
  const permitted = new Set(input.permittedColumns ?? input.workspacePolicy.allowedColumns);
  const workspaceAllowed = input.workspacePolicy.allowedColumns.filter((column) => permitted.has(column));
  const roleAllowed = input.rolePolicy ? input.rolePolicy.allowedColumns.filter((column) => workspaceAllowed.includes(column)) : workspaceAllowed;
  const available = new Set(roleAllowed);
  const required = Array.from(new Set([...input.workspacePolicy.requiredColumns, ...(input.rolePolicy?.requiredColumns ?? [])])).filter((column) => permitted.has(column));
  const selected = input.userPreference?.visibleColumns ?? input.rolePolicy?.defaultColumns ?? input.workspacePolicy.defaultColumns;
  return { visibleColumns: Array.from(new Set([...required, ...selected.filter((column) => available.has(column))])), removedColumns: selected.filter((column) => !available.has(column)), source: input.userPreference ? "USER" : input.rolePolicy ? "ROLE" : "WORKSPACE" };
}

export const getReceivableConfiguration = () => repository.getSnapshot().receivableConfiguration;
export const getReasonCatalog = (catalog: string) => repository.getSnapshot().reasonCatalogs.find((item) => item.catalog === catalog);
