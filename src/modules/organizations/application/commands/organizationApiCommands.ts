import { invalidateModuleQueries, runBackendProjection } from "@/shared/application";
import type { OrganizationAccount } from "../../domain/model/organizationAccount.types";
import { getOrganizationApiRuntime, organizationAccountRepository } from "../composition/organizationApplicationServices";
import type { OrganizationArchiveCommand, OrganizationCreateCommand, OrganizationUpdateCommand } from "../ports/OrganizationApiRuntime";
import { saveOrganizationAccount } from "./organizationAccountRepositoryCommands";

export const createOrganizationViaApi = (input: OrganizationCreateCommand) => execute("organization.create", (commands) => commands.create(input));
export const updateOrganizationViaApi = (input: OrganizationUpdateCommand) => execute("organization.update", (commands) => commands.update(input));
export const archiveOrganizationViaApi = (input: OrganizationArchiveCommand) => execute("organization.archive", (commands) => commands.archive(input));

async function execute(commandType: string, call: (commands: NonNullable<ReturnType<typeof getOrganizationApiRuntime>["commands"]>) => Promise<OrganizationAccount>): Promise<OrganizationAccount> {
  const commands = getOrganizationApiRuntime().commands;
  if (!commands) throw new Error("ORGANIZATION_COMMANDS_UNAVAILABLE");
  const organization = await call(commands);
  runBackendProjection("organizations", () => saveOrganizationAccount(organizationAccountRepository, organization));
  await invalidateModuleQueries({ moduleKeys: ["organizations"], commandType, aggregateId: organization.id, occurredAt: organization.updatedAt ?? new Date().toISOString() });
  return organization;
}
