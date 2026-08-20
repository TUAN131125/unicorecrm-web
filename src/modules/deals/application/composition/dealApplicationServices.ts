import { createApplicationServiceBinding } from "@/shared/application";
import type { DealApiRuntime } from "../ports/DealApiRuntime";
import type { DealExporter } from "../ports/DealExporter";
import type { DealRepository } from "../ports/DealRepository";
import type { DealStageRepository } from "../ports/DealStageRepository";

export interface DealApplicationServices {
  api: DealApiRuntime;
  repository: DealRepository;
  stages: DealStageRepository;
  exporter: DealExporter;
}

const binding = createApplicationServiceBinding<DealApplicationServices>("Deals");
export const configureDealApplication = binding.configure;
export const getDealApplicationServices = binding.get;
export const resetDealApplication = binding.reset;

import { createApplicationServiceProxy } from "@/shared/application";
export const dealRepository = createApplicationServiceProxy(() => binding.get().repository);
export function getDealApiRuntime(): DealApiRuntime { return binding.get().api; }
export function isDealConnectedApiRuntime(): boolean { return binding.get().api.mode === "connected"; }
export const dealStageRepository = createApplicationServiceProxy(() => binding.get().stages);
export const exportDealsCsv: DealExporter["exportCsv"] = (...args) => binding.get().exporter.exportCsv(...args);
