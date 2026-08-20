import type { AppEventBus } from "@/platform/events";
import type { StoragePort } from "@/platform/persistence";
import type { SupportCaseRepository } from "../application/ports/SupportCaseRepository";
import type { SupportCase } from "../domain/model/supportCase.types";

export const SUPPORT_CASES_CHANGED_EVENT = "unicore.support.cases.changed";

export class InMemorySupportCaseRepository implements SupportCaseRepository {
  private cases: SupportCase[];

  constructor(
    seed: readonly SupportCase[],
    private readonly events: AppEventBus,
    private readonly storage?: StoragePort,
  ) {
    this.cases = cloneCases(storage?.get<SupportCase[]>("cases") ?? seed);
  }

  list(): SupportCase[] { return cloneCases(this.cases); }
  getById(caseId: string): SupportCase | undefined {
    const item = this.cases.find((supportCase) => supportCase.id === caseId);
    return item ? structuredClone(item) : undefined;
  }
  replace(cases: SupportCase[]): void {
    this.cases = cloneCases(cases);
    this.storage?.set("cases", this.cases);
    this.events.publish<SupportCase[]>(SUPPORT_CASES_CHANGED_EVENT, this.list());
  }
  subscribe(listener: (cases: SupportCase[]) => void): () => void {
    return this.events.subscribe<SupportCase[]>(SUPPORT_CASES_CHANGED_EVENT, listener);
  }
}

function cloneCases(cases: readonly SupportCase[]): SupportCase[] { return structuredClone([...cases]); }
