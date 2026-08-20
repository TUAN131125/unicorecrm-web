import { createApplicationServiceBinding } from "@/shared/application";
import type { ExternalAuthorityHealthAuthority } from "./externalAuthorityHealth";

const binding = createApplicationServiceBinding<ExternalAuthorityHealthAuthority>("External authority health authority");

export const configureExternalAuthorityHealthAuthority = binding.configure;
export const getExternalAuthorityHealthAuthority = binding.get;
export const resetExternalAuthorityHealthAuthority = binding.reset;
export const isExternalAuthorityHealthAuthorityConfigured = binding.isConfigured;
