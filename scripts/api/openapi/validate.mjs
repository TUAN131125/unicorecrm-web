import fs from "node:fs";
import path from "node:path";
import { repositoryRoot } from "../../quality/core/repo-context.mjs";
const HTTP_METHODS = ["get", "post", "put", "patch", "delete"];

export function resolveRef(document, value) {
  if (!value?.$ref) return value;
  const prefix = "#/components/";
  if (!value.$ref.startsWith(prefix)) throw new Error(`Unsupported reference ${value.$ref}.`);
  const [collection, name] = value.$ref.slice(prefix.length).split("/");
  const resolved = document.components?.[collection]?.[name];
  if (!resolved) throw new Error(`Unresolved reference ${value.$ref}.`);
  return resolved;
}

export function refName(ref) {
  return ref.slice(ref.lastIndexOf("/") + 1);
}

export function collectOperations(document) {
  const operations = [];
  for (const [route, pathItem] of Object.entries(document.paths ?? {})) {
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (!operation) continue;
      operations.push({
        route,
        method: method.toUpperCase(),
        operationId: operation.operationId,
        operation,
        pathItem,
      });
    }
  }
  return operations.sort((left, right) => left.operationId.localeCompare(right.operationId));
}

export function operationParameters(document, operationRecord) {
  const parameters = [...(operationRecord.pathItem.parameters ?? []), ...(operationRecord.operation.parameters ?? [])]
    .map((parameter) => resolveRef(document, parameter));
  return {
    all: parameters,
    path: parameters.filter((parameter) => parameter.in === "path"),
    query: parameters.filter((parameter) => parameter.in === "query"),
    header: parameters.filter((parameter) => parameter.in === "header"),
  };
}

export function responseType(operation) {
  const success = operation.responses?.["200"] ?? operation.responses?.["201"] ?? operation.responses?.["202"] ?? operation.responses?.["202"];
  const schema = success?.content?.["application/json"]?.schema;
  if (!schema?.$ref) throw new Error(`Operation ${operation.operationId} must use a named success response schema.`);
  return refName(schema.$ref);
}

export function requestBodyType(operation) {
  const schema = operation.requestBody?.content?.["application/json"]?.schema;
  return schema?.$ref ? refName(schema.$ref) : undefined;
}

export function getServerPath(document) {
  const url = document.servers?.[0]?.url;
  if (typeof url !== "string" || !url.startsWith("/") || url.endsWith("/")) {
    throw new Error("The first OpenAPI server URL must be an absolute path without a trailing slash.");
  }
  return url;
}

export function validateDocument(document, ownership, qualityGateIds = new Set()) {
  if (document.openapi !== "3.1.0") throw new Error(`Expected OpenAPI 3.1.0, received ${document.openapi}.`);
  if (document.jsonSchemaDialect !== "https://json-schema.org/draft/2020-12/schema") {
    throw new Error("OpenAPI contract must use JSON Schema 2020-12.");
  }
  if (!document.info?.version) throw new Error("OpenAPI info.version is required.");
  getServerPath(document);

  if (ownership?.schemaVersion !== 1 || !Array.isArray(ownership.clients) || ownership.clients.length === 0) {
    throw new Error("OpenAPI client ownership manifest must use schemaVersion 1 and define clients.");
  }

  if (!Array.isArray(ownership.approvedExternalTransports ?? [])) {
    throw new Error("approvedExternalTransports must be an array when provided.");
  }
  for (const transport of ownership.approvedExternalTransports ?? []) {
    if (!transport.path || !transport.ownerModule || !transport.purpose || !Array.isArray(transport.routePrefixes) || transport.routePrefixes.length === 0) {
      throw new Error("Each approved external transport requires path, ownerModule, purpose and routePrefixes.");
    }
    if (!fs.existsSync(path.join(repositoryRoot, transport.path))) {
      throw new Error(`Approved external transport ${transport.path} does not exist.`);
    }
  }

  const clientIds = new Set();
  const tagOwners = new Map();
  for (const client of ownership.clients) {
    if (!client.id || clientIds.has(client.id)) throw new Error(`Duplicate or missing generated client id ${client.id ?? "<missing>"}.`);
    clientIds.add(client.id);
    if (!client.output?.startsWith("src/platform/api/generated/") || !client.output.endsWith(".ts")) {
      throw new Error(`Generated client ${client.id} has an invalid output path.`);
    }
    if (!client.className || !Array.isArray(client.tags) || client.tags.length === 0) {
      throw new Error(`Generated client ${client.id} is missing className or tags.`);
    }
    if (client.requestOptionsName !== null && (typeof client.requestOptionsName !== "string" || client.requestOptionsName.length === 0)) {
      throw new Error(`Generated client ${client.id} must declare requestOptionsName or explicit null.`);
    }
    if (!Array.isArray(client.testGateIds) || client.testGateIds.length === 0) {
      throw new Error(`Generated client ${client.id} must declare stable test gate coverage.`);
    }
    for (const gateId of client.testGateIds) {
      if (qualityGateIds.size > 0 && !qualityGateIds.has(gateId)) throw new Error(`Generated client ${client.id} references unknown quality gate ${gateId}.`);
    }
    for (const tag of client.tags) {
      if (tagOwners.has(tag)) throw new Error(`OpenAPI tag ${tag} is owned by multiple generated clients.`);
      const ownerModule = client.ownerByTag?.[tag];
      if (!ownerModule) throw new Error(`OpenAPI tag ${tag} has no owner module.`);
      const adapterPath = client.adapterByTag?.[tag];
      if (adapterPath && !fs.existsSync(path.join(repositoryRoot, adapterPath))) {
        throw new Error(`OpenAPI tag ${tag} references missing HTTP adapter ${adapterPath}.`);
      }
      tagOwners.set(tag, client);
    }
  }

  const outputPaths = ownership.clients.map((client) => client.output);
  if (new Set(outputPaths).size !== outputPaths.length) throw new Error("Generated client output paths must be unique.");

  const operations = collectOperations(document);
  const operationIds = operations.map((operation) => operation.operationId);
  if (operationIds.some((operationId) => typeof operationId !== "string" || operationId.length === 0)) {
    throw new Error("Every OpenAPI operation must define operationId.");
  }
  if (new Set(operationIds).size !== operationIds.length) throw new Error("OpenAPI operationId values must be unique.");

  for (const record of operations) {
    const tags = record.operation.tags ?? [];
    if (tags.length !== 1) throw new Error(`Operation ${record.operationId} must have exactly one bounded-context tag.`);
    if (!tagOwners.has(tags[0])) throw new Error(`Operation ${record.operationId} uses unowned tag ${tags[0]}.`);
    const contractStatus = record.operation["x-contract-status"] ?? "PRODUCTION_CONTRACT_READY";
    if (contractStatus === "BLOCKED") {
      if (!record.operation["x-blocking-decision-id"]) throw new Error(`Blocked operation ${record.operationId} requires x-blocking-decision-id.`);
      if (["200", "201", "202", "204"].some((status) => record.operation.responses?.[status])) {
        throw new Error(`Blocked operation ${record.operationId} must not declare a success response.`);
      }
    } else {
      responseType(record.operation);
      if (record.operation.requestBody && !requestBodyType(record.operation)) {
        throw new Error(`Operation ${record.operationId} must use a named request body schema.`);
      }
    }
    for (const parameter of [...(record.pathItem.parameters ?? []), ...(record.operation.parameters ?? [])]) resolveRef(document, parameter);
  }

  for (const required of [
    "listReceivables", "getReceivablesSummary", "getReceivablesAging", "getBuyerAccountStatement",
    "listInvoices", "createInvoiceDraft", "saveInvoiceDraft", "issueInvoice", "retryInvoiceIssue", "sendInvoice",
    "createInvoiceCreditNote", "discardInvoiceDraft", "voidInvoice",
    "listPaymentRecords", "recordManualPayment", "allocatePayment", "allocateCustomerCredit", "listPaymentAllocations",
    "previewPaymentPlan", "savePaymentPlanDraft", "activatePaymentPlan", "cancelPaymentPlan",
    "createPaymentIntent", "getPaymentIntent", "getPaymentIntentStatus", "cancelPaymentIntent", "retryPaymentIntent",
    "reversePaymentAllocation", "reconcilePaymentRecord", "recordCodCustomerCollection", "recordCodMerchantRemittance",
    "recordPaymentRequestDelivery", "createRefundIntent", "getRefund",
    "listOrganizations", "createOrganization", "listContacts", "createContact",
    "listCustomers", "onboardExistingCustomer", "listProducts", "createProduct",
    "listLeads", "createLead", "qualifyLead", "listDeals", "createQuoteForDeal",
    "listQuotes", "acceptQuote", "listOrders",
    "getWorkspaceConfiguration", "updateWorkspaceBusinessInformation", "updateWorkspaceLocaleRegion", "updateWorkspaceFeatures",
    "updateWorkspaceBlueprint", "publishWorkspaceConfiguration", "listWorkspaceConfigurationAudit",
    "getWorkspaceCurrencies", "replaceWorkspaceCurrencies", "listWorkspaceExchangeRates", "putWorkspaceExchangeRate",
    "getStudioQuickSetup", "openStudioQuickSetup", "dismissStudioQuickSetupAutoOpen", "completeStudioQuickSetupStep", "skipStudioQuickSetupStep",
    "listCrmPipelines", "createCrmPipeline", "updateCrmPipeline", "deleteCrmPipeline", "createCrmPipelineStage", "updateCrmPipelineStage", "deleteCrmPipelineStage",
    "listCrmObjectSchemas", "getCrmObjectSchema", "createCrmObjectField", "updateCrmObjectField", "deleteCrmObjectField",
    "listProductConfigurationTypes", "createProductConfigurationType", "updateProductConfigurationType", "deleteProductConfigurationType",
    "listPaymentReceivingAccounts", "replacePaymentReceivingAccounts", "getInvoiceSellerInformationConfiguration", "replaceInvoiceSellerInformationConfiguration",
    "listShippingPickupLocations", "listShippingReturnLocations", "listIntegrationProviders", "listIntegrationConnections", "createIntegrationConnection",
    "updateIntegrationConnection", "verifyIntegrationConnection", "disconnectIntegrationConnection",
  ]) {
    if (!operationIds.includes(required)) throw new Error(`Missing required operationId ${required}.`);
  }

  return { operations, tagOwners };
}
