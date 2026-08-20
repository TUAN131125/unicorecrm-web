import { createApplicationServiceBinding } from "@/shared/application";
import type { OrderClosingPorts } from "../ports/OrderClosingPorts";

const binding = createApplicationServiceBinding<OrderClosingPorts>("Order Closing workflow");
export const configureOrderClosingApplication = binding.configure;
export const createOrderClosingRuntime = () => binding.get();
