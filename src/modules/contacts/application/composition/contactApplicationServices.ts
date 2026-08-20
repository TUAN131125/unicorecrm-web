import type { PreferencePort } from "@/platform/preferences";
import { createApplicationServiceBinding } from "@/shared/application";
import type { ContactRepository } from "../ports/ContactRepository";
import type { ContactApiRuntime } from "../ports/ContactApiRuntime";

export interface ContactApplicationServices {
  repository: ContactRepository;
  preferences: PreferencePort;
  api: ContactApiRuntime;
}

const binding = createApplicationServiceBinding<ContactApplicationServices>("Contacts");
export const configureContactApplication = binding.configure;
export const getContactApplicationServices = binding.get;
export const resetContactApplication = binding.reset;

import { createApplicationServiceProxy } from "@/shared/application";
export const contactRepository = createApplicationServiceProxy(() => binding.get().repository);
export const contactPreferences = createApplicationServiceProxy(() => binding.get().preferences);
export function getContactApiRuntime(): ContactApiRuntime { return binding.get().api; }
export function isContactConnectedApiRuntime(): boolean { return binding.get().api.mode === "connected"; }
