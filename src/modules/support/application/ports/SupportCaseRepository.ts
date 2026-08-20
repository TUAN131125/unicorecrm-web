import type { SupportCase } from "../../domain/model/supportCase.types";

export interface SupportCaseRepository {
  list(): SupportCase[];
  getById(caseId: string): SupportCase | undefined;
  replace(cases: SupportCase[]): void;
  subscribe(listener: (cases: SupportCase[]) => void): () => void;
}
