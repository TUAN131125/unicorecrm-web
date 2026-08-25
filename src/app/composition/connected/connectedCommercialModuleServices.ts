import type { HttpClient } from "@/platform/api";
import { createTaskConnectedApiRuntime } from "@/modules/tasks/infrastructure/http/createTaskConnectedApiRuntime";
import { createSupportConnectedApiRuntime } from "@/modules/support/infrastructure/http/createSupportConnectedApiRuntime";
import type { CommercialEvidenceApplicationServices } from "@/modules/commercial-evidence/application/composition/commercialEvidenceApplicationServices";
import type { PurchaseEvidenceRepositorySnapshot } from "@/modules/commercial-evidence/application/ports/PurchaseEvidenceRepository";
import type { PurchaseEvidence } from "@/modules/commercial-evidence/domain/model/purchaseEvidence.types";
import { createOrderConnectedApiRuntime } from "@/modules/orders/infrastructure/http/createOrderConnectedApiRuntime";
import type { OrderApplicationServices } from "@/modules/orders/application/composition/orderApplicationServices";
import type { OrderCollection } from "@/modules/orders/application/ports/OrderRepository";
import type { CustomerOrder } from "@/modules/orders/domain/model/order.types";
import type { QuoteApplicationServices } from "@/modules/quotes/application/composition/quoteApplicationServices";
import type { Quote } from "@/modules/quotes/domain/model/quote.types";
import { createQuoteConnectedApiRuntime } from "@/modules/quotes/infrastructure/http/createQuoteConnectedApiRuntime";
import type { ReturnApplicationServices } from "@/modules/returns/application/composition/returnApplicationServices";
import { createReturnConnectedApiRuntime } from "@/modules/returns/infrastructure/http/createReturnConnectedApiRuntime";
import type { ReturnRequest, ReturnResolutionIntent, ReturnSnapshot } from "@/modules/returns/domain/model/return.types";
import type { ShippingApplicationServices } from "@/modules/shipping/application/composition/shippingApplicationServices";
import { createShippingConnectedApiRuntime } from "@/modules/shipping/infrastructure/http/createShippingConnectedApiRuntime";
import type { PickupLocationConfiguration } from "@/modules/shipping/domain/model/shippingConfiguration.types";
import type { ShippingProvider } from "@/modules/shipping/domain/model/shippingProvider";
import type { ShippingBooking } from "@/modules/shipping/domain/model/shipping.types";
import type { SupportApplicationServices } from "@/modules/support/application/composition/supportApplicationServices";
import type { SupportCase } from "@/modules/support/domain/model/supportCase.types";
import type { TaskApplicationServices } from "@/modules/tasks/application/composition/taskApplicationServices";
import type { Activity, Task, TaskActivitySnapshot } from "@/modules/tasks/domain/model/task.types";
import { relationshipRefKey } from "@/platform/identity";
import {
  ConnectedCollectionProjection,
  ConnectedSnapshotProjection,
  unavailableConnectedOperation,
} from "./connectedProjectionRepositories";
import { createConnectedPreferencePort } from "./connectedClientUtilities";

export interface ConnectedCommercialModuleServices {
  commercialEvidence: CommercialEvidenceApplicationServices;
  orders: OrderApplicationServices;
  quotes: QuoteApplicationServices;
  returns: ReturnApplicationServices;
  shipping: ShippingApplicationServices;
  support: SupportApplicationServices;
  tasks: TaskApplicationServices;
}

export function createConnectedCommercialModuleServices(httpClient: HttpClient): ConnectedCommercialModuleServices {
  return {
    commercialEvidence: createCommercialEvidence(),
    orders: createOrders(httpClient),
    quotes: createQuotes(httpClient),
    returns: createReturns(httpClient),
    shipping: createShipping(httpClient),
    support: createSupport(httpClient),
    tasks: createTasks(httpClient),
  };
}

function createCommercialEvidence(): CommercialEvidenceApplicationServices {
  const projection = new ConnectedSnapshotProjection<PurchaseEvidenceRepositorySnapshot>("commercialEvidence", { evidence: [] });
  return {
    repository: {
      snapshot: () => projection.snapshot(),
      list: () => projection.snapshot().evidence,
      append: (evidence: PurchaseEvidence) => projection.update((snapshot) => ({ evidence: upsertByKey(snapshot.evidence, evidence, (record) => record.evidenceId) })).evidence.find((record) => record.evidenceId === evidence.evidenceId) ?? evidence,
      runInTransaction: (work) => work(),
      findById: (id) => projection.snapshot().evidence.find((record) => record.evidenceId === id),
      findBySource: (sourceType, sourceId, evidenceType) => projection.snapshot().evidence.find((record) => record.sourceType === sourceType && record.sourceId === sourceId && record.evidenceType === evidenceType),
      findByCorrelation: (correlationId) => projection.snapshot().evidence.find((record) => record.correlationId === correlationId),
      subscribe: (listener) => projection.subscribe(listener),
    },
  };
}

function createOrders(httpClient: HttpClient): OrderApplicationServices {
  const projection = new ConnectedSnapshotProjection<OrderCollection>("orders", {});
  return {
    api: createOrderConnectedApiRuntime(httpClient),
    repository: {
      snapshot: () => projection.snapshot(),
      list: () => Object.values(projection.snapshot()).flat(),
      getById: (id) => Object.values(projection.snapshot()).flat().find((record) => record.id === id),
      replace: (snapshot) => projection.replace(snapshot),
      subscribe: (listener) => projection.subscribe(listener),
    },
    preferences: createConnectedPreferencePort(),
  };
}

function createQuotes(httpClient: HttpClient): QuoteApplicationServices {
  const projection = new ConnectedCollectionProjection<Quote>("quotes", (record) => record.id);
  return {
    api: createQuoteConnectedApiRuntime(httpClient),
    repository: {
      list: () => projection.list(),
      getById: (id) => projection.getById(id),
      replace: (records) => projection.replace(records),
      subscribe: (listener) => projection.subscribe(listener),
    },
    preferences: createConnectedPreferencePort(),
  };
}

function createReturns(httpClient: HttpClient): ReturnApplicationServices {
  const projection = new ConnectedSnapshotProjection<ReturnSnapshot>("returns", { requests: [], intents: [] });
  return {
    api: createReturnConnectedApiRuntime(httpClient),
    repository: {
      snapshot: () => projection.snapshot(),
      listRequests: () => projection.snapshot().requests,
      listIntents: () => projection.snapshot().intents,
      findById: (id) => projection.snapshot().requests.find((record) => record.id === id),
      findIntentByIdempotencyKey: (key) => projection.snapshot().intents.find((record) => record.idempotencyKey === key),
      saveRequest: (request: ReturnRequest) => projection.update((snapshot) => ({ ...snapshot, requests: upsertById(snapshot.requests, request) })).requests.find((record) => record.id === request.id) ?? request,
      saveIntent: (intent: ReturnResolutionIntent) => projection.update((snapshot) => ({ ...snapshot, intents: upsertById(snapshot.intents, intent) })).intents.find((record) => record.id === intent.id) ?? intent,
      replace: (snapshot) => projection.replace(snapshot),
      subscribe: (listener) => projection.subscribe(listener),
    },
  };
}

function createShipping(httpClient: HttpClient): ShippingApplicationServices {
  const projection = new ConnectedCollectionProjection<ShippingBooking>("shipping", (record) => record.id);
  let providerProjection: ShippingProvider[] = [];
  let pickupProjection: PickupLocationConfiguration[] = [];
  let returnProjection: PickupLocationConfiguration[] = [];
  return {
    api: createShippingConnectedApiRuntime(httpClient),
    repository: {
      list: () => projection.list(),
      findById: (id) => projection.getById(id),
      findByIdempotencyKey: (key) => projection.list().find((record) => record.idempotencyKey === key),
      save: (record) => projection.upsert(record),
      replace: (records) => projection.replace(records),
      subscribe: (listener) => projection.subscribe(listener),
    },
    providers: {
      get: (providerId) => providerProjection.find((provider) => provider.id === providerId),
      list: () => providerProjection,
      replace: (providers) => { providerProjection = [...providers]; },
    },
    configuration: {
      getPickupLocations: () => pickupProjection,
      getReturnLocations: () => returnProjection,
      getProviders: () => [],
      saveProviders: unavailableConnectedOperation("Shipping provider configuration"),
      replaceLocations: (pickup, returns) => {
        pickupProjection = [...pickup];
        returnProjection = [...returns];
      },
    },
  };
}

function createSupport(httpClient: HttpClient): SupportApplicationServices {
  const projection = new ConnectedCollectionProjection<SupportCase>("support", (record) => record.id);
  return {
    api: createSupportConnectedApiRuntime(httpClient),
    repository: {
      list: () => projection.list(),
      getById: (id) => projection.getById(id),
      replace: (records) => projection.replace(records),
      subscribe: (listener) => projection.subscribe(listener),
    },
  };
}

function createTasks(httpClient: HttpClient): TaskApplicationServices {
  const projection = new ConnectedSnapshotProjection<TaskActivitySnapshot>("tasks", { tasks: [], activities: [] });
  return {
    api: createTaskConnectedApiRuntime(httpClient),
    repository: {
      snapshot: () => projection.snapshot(),
      listTasks: () => projection.snapshot().tasks,
      listActivities: () => projection.snapshot().activities,
      findTaskById: (id) => projection.snapshot().tasks.find((record) => record.id === id),
      findTaskByDedupeKey: (key) => projection.snapshot().tasks.find((record) => record.dedupeKey === key),
      saveTask: (task: Task) => projection.update((snapshot) => ({ ...snapshot, tasks: upsertById(snapshot.tasks, task) })).tasks.find((record) => record.id === task.id) ?? task,
      saveActivity: (activity: Activity) => projection.update((snapshot) => ({ ...snapshot, activities: upsertById(snapshot.activities, activity) })).activities.find((record) => record.id === activity.id) ?? activity,
      replace: (snapshot) => projection.replace(snapshot),
      subscribe: (listener) => projection.subscribe(listener),
    },
  };
}

export function orderCollectionFromRecords(records: readonly CustomerOrder[]): OrderCollection {
  const collection: OrderCollection = {};
  for (const record of records) {
    const key = relationshipRefKey(record.buyerRef);
    collection[key] = [...(collection[key] ?? []), record];
  }
  return collection;
}

function upsertByKey<T>(
  records: readonly T[],
  record: T,
  readKey: (record: T) => string,
): T[] {
  const key = readKey(record);
  return records.some((candidate) => readKey(candidate) === key)
    ? records.map((candidate) => readKey(candidate) === key ? record : candidate)
    : [...records, record];
}

function upsertById<T extends { id: string }>(records: readonly T[], record: T): T[] {
  return records.some((candidate) => candidate.id === record.id)
    ? records.map((candidate) => candidate.id === record.id ? record : candidate)
    : [...records, record];
}
