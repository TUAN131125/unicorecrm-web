import type { ReturnRepository } from "../application/ports/ReturnRepository";
import type { ReturnRequest, ReturnResolutionIntent, ReturnSnapshot } from "../domain/model/return.types";

export class InMemoryReturnRepository implements ReturnRepository {
  private state: ReturnSnapshot;
  private readonly listeners = new Set<(snapshot: ReturnSnapshot) => void>();
  constructor(seed: ReturnSnapshot) { this.state = structuredClone(seed); }
  snapshot(): ReturnSnapshot { return structuredClone(this.state); }
  listRequests(): ReturnRequest[] { return structuredClone(this.state.requests); }
  listIntents(): ReturnResolutionIntent[] { return structuredClone(this.state.intents); }
  findById(returnId: string): ReturnRequest | undefined { const found = this.state.requests.find((item) => item.id === returnId); return found ? structuredClone(found) : undefined; }
  findIntentByIdempotencyKey(key: string): ReturnResolutionIntent | undefined { const found = this.state.intents.find((item) => item.idempotencyKey === key); return found ? structuredClone(found) : undefined; }
  saveRequest(request: ReturnRequest): ReturnRequest { this.state.requests = [structuredClone(request), ...this.state.requests.filter((item) => item.id !== request.id)]; this.emit(); return structuredClone(request); }
  saveIntent(intent: ReturnResolutionIntent): ReturnResolutionIntent { this.state.intents = [structuredClone(intent), ...this.state.intents.filter((item) => item.id !== intent.id)]; this.emit(); return structuredClone(intent); }
  replace(snapshot: ReturnSnapshot): void { this.state = structuredClone(snapshot); this.emit(); }
  subscribe(listener: (snapshot: ReturnSnapshot) => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  private emit(): void { const current = this.snapshot(); this.listeners.forEach((listener) => listener(current)); }
}
