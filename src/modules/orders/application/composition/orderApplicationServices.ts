import type { PreferencePort } from "@/platform/preferences";
import { createApplicationServiceBinding } from "@/shared/application";
import type { OrderApiRuntime } from "../ports/OrderApiRuntime";
import type { OrderRepository } from "../ports/OrderRepository";

export interface OrderApplicationServices {
  api: OrderApiRuntime;
  repository: OrderRepository;
  preferences: PreferencePort;
}

const binding = createApplicationServiceBinding<OrderApplicationServices>("Orders");
export const configureOrderApplication = binding.configure;
export const getOrderApplicationServices = binding.get;
export const resetOrderApplication = binding.reset;

import { createApplicationServiceProxy } from "@/shared/application";
export const orderRepository = createApplicationServiceProxy(() => binding.get().repository);
export const orderPreferences = createApplicationServiceProxy(() => binding.get().preferences);

export function getOrderApiRuntime(): OrderApiRuntime { return binding.get().api; }
export function isOrderConnectedApiRuntime(): boolean { return binding.get().api.mode === "connected"; }
