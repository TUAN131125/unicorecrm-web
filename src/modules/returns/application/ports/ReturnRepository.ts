import type { ReturnRequest, ReturnResolutionIntent, ReturnSnapshot } from "../../domain/model/return.types";

export interface ReturnRepository {
  snapshot(): ReturnSnapshot;
  listRequests(): ReturnRequest[];
  listIntents(): ReturnResolutionIntent[];
  findById(returnId: string): ReturnRequest | undefined;
  findIntentByIdempotencyKey(key: string): ReturnResolutionIntent | undefined;
  saveRequest(request: ReturnRequest): ReturnRequest;
  saveIntent(intent: ReturnResolutionIntent): ReturnResolutionIntent;
  replace(snapshot: ReturnSnapshot): void;
  subscribe(listener: (snapshot: ReturnSnapshot) => void): () => void;
}
