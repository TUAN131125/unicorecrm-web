import { createApplicationServiceBinding } from "@/shared/application";
import type { DealRecyclePorts } from "../ports/DealRecyclePorts";

const binding = createApplicationServiceBinding<DealRecyclePorts>("Deal Recycle workflow");
export const configureDealRecycleApplication = binding.configure;
export const createDealRecycleRuntime = () => binding.get();
