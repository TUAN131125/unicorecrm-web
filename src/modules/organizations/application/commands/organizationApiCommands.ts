import { invalidateModuleQueries } from "@/shared/application";
import type { OrganizationAccount } from "../../domain/model/organizationAccount.types";
import { getOrganizationApiRuntime } from "../composition/organizationApplicationServices";
import type { OrganizationArchiveCommand, OrganizationCommandOptions, OrganizationCreateCommand, OrganizationUpdateCommand } from "../ports/OrganizationApiRuntime";

export const createOrganizationViaApi = (input: OrganizationCreateCommand, options: OrganizationCommandOptions = {}) => execute("organization.create", (commands) => commands.create(input, options));
export const updateOrganizationViaApi = (input: OrganizationUpdateCommand, options: OrganizationCommandOptions = {}) => execute("organization.update", (commands) => commands.update(input, options));
export const archiveOrganizationViaApi = (input: OrganizationArchiveCommand) => execute("organization.archive", (commands) => commands.archive(input));

async function execute(commandType: string, call: (commands: NonNullable<ReturnType<typeof getOrganizationApiRuntime>["commands"]>) => Promise<OrganizationAccount>): Promise<OrganizationAccount> {
  const commands = getOrganizationApiRuntime().commands;
  if (!commands) throw new Error("ORGANIZATION_COMMANDS_UNAVAILABLE");
  const organization = await call(commands);
  // Authorized command responses are returned directly; queries refresh their own read projections.
  await invalidateModuleQueries({ moduleKeys: ["organizations"], commandType, aggregateId: organization.id, occurredAt: organization.updatedAt ?? new Date().toISOString() });
  return organization;
}
