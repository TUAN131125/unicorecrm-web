import { assertRuntimeWorkspaceAccess } from "@/platform/access-control";
import { executeResilientIntegrationOperation } from "@/platform/enterprise-security";
import { recordOperationalAudit } from "@/platform/operational-audit";
import { getWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { LeadWorkState } from "../../domain/model/leadLifecycle.canonical";
import type { Lead } from "../../domain/model/lead.types";
import { normalizeEmail as normalizeContactEmail, normalizePhone as normalizeContactPhone, validateEmail, validatePhone } from "@/platform/contact-data";
import { saveLead } from "../../application/commands/leadRepositoryCommands";
import type { LeadRepository } from "../../application/ports/LeadRepository";
import type { IngestLeadWebhookCommand, LeadWebhookIngressPort, LeadWebhookIngressResult } from "../../application/ports/LeadWebhookIngressPort";

const normalizeEmail = (value?: string) => value ? normalizeContactEmail(value) : "";
const normalizePhone = (value?: string) => value ? normalizeContactPhone(value) : "";

function assertWebhookAuthentication(command: IngestLeadWebhookCommand, now: Date): void {
  if (!command.authentication.verified) throw new Error("Lead webhook authentication failed.");
  if (!command.authentication.keyId.trim()) throw new Error("Lead webhook requires a credential key reference.");
  const signedAt = new Date(command.authentication.signedAt).getTime();
  if (!Number.isFinite(signedAt) || Math.abs(now.getTime() - signedAt) > 5 * 60_000) {
    throw new Error("Lead webhook signature timestamp is outside the accepted replay window.");
  }
}

export function createLeadWebhookIngress(repository: LeadRepository): LeadWebhookIngressPort {
  return { ingest: (command) => ingestLeadWebhook(repository, command) };
}

async function ingestLeadWebhook(repository: LeadRepository, command: IngestLeadWebhookCommand): Promise<LeadWebhookIngressResult> {
  const now = new Date(command.now ?? new Date().toISOString());
  assertWebhookAuthentication(command, now);
  if (!command.idempotencyKey.trim()) throw new Error("Lead webhook requires idempotency key.");
  if (command.payload.email && !validateEmail(command.payload.email).valid) throw new Error("Lead webhook email is invalid.");
  if (command.payload.phone && !validatePhone(command.payload.phone).valid) throw new Error("Lead webhook phone is invalid.");
  if (getWorkspaceContextSnapshot().workspaceId !== command.workspaceId) throw new Error("Lead webhook tenant does not match the active workspace repository.");
  assertRuntimeWorkspaceAccess(command.workspaceId);

  const execution = await executeResilientIntegrationOperation({
    workspaceId: command.workspaceId,
    connectorId: command.connectorId,
    idempotencyKey: command.idempotencyKey,
    operation: () => ingestAuthenticatedLead(repository, command, now.toISOString()),
    sleep: async () => undefined,
  });

  if (execution.status === "RATE_LIMITED") {
    return { disposition: "RATE_LIMITED", attempts: 0, nextRetryAt: execution.nextRetryAt };
  }
  if (execution.status === "FAILED" || !execution.value) throw new Error(`Lead webhook failed after ${execution.attempts.length} attempts.`);
  return {
    ...execution.value,
    disposition: execution.status === "IDEMPOTENT_REPLAY" ? "IDEMPOTENT_REPLAY" : execution.value.disposition,
    attempts: execution.attempts.length,
  };
}

function ingestAuthenticatedLead(repository: LeadRepository, command: IngestLeadWebhookCommand, now: string): { disposition: "CREATED" | "APPENDED"; leadId: string } {
  const name = command.payload.name?.trim();
  const email = normalizeEmail(command.payload.email);
  const phone = normalizePhone(command.payload.phone);
  if (!name) throw new Error("Lead webhook requires name.");
  if (!email && !phone) throw new Error("Lead webhook requires email or phone.");

  const source = command.payload.source?.trim() || "Webhook";
  const existing = repository.list().find((lead) => lead.leadWorkState !== LeadWorkState.CLOSED && (
    (email && normalizeEmail(lead.email) === email) || (phone && normalizePhone(lead.phone) === phone)
  ));

  let saved: Lead;
  let disposition: "CREATED" | "APPENDED";
  if (existing) {
    saved = saveLead(repository, {
      ...existing,
      source: existing.source || source,
      campaignId: command.payload.campaign?.trim() || existing.campaignId,
      notes: command.payload.summary?.trim() || existing.notes,
      sourceLineage: [...(existing.sourceLineage || []), {
        signalId: `webhook_${command.connectorId}_${command.idempotencyKey}`,
        source,
        occurredAt: command.payload.occurredAt || now,
        sourceRecordId: command.payload.sourceRecordId || command.idempotencyKey,
      }],
      updatedAt: now,
    });
    disposition = "APPENDED";
  } else {
    const id = `lead_webhook_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    saved = saveLead(repository, {
      id,
      name,
      title: "",
      companyName: command.payload.companyName?.trim() || "",
      email,
      phone,
      source,
      campaignId: command.payload.campaign?.trim() || undefined,
      score: 0,
      leadWorkState: LeadWorkState.NEW,
      ownerId: "unassigned",
      interestedProducts: [],
      createdAt: now,
      notes: command.payload.summary?.trim() || undefined,
      activities: [],
      sourceLineage: [{
        signalId: `webhook_${command.connectorId}_${command.idempotencyKey}`,
        source,
        occurredAt: command.payload.occurredAt || now,
        sourceRecordId: command.payload.sourceRecordId || command.idempotencyKey,
      }],
    });
    disposition = "CREATED";
  }

  recordOperationalAudit({
    workspaceId: command.workspaceId,
    moduleKey: "leads",
    recordId: saved.id,
    action: disposition === "CREATED" ? "LeadWebhookCreated" : "LeadWebhookAppended",
    actorId: command.actorId || `connector:${command.connectorId}`,
    reason: `source=${source}; keyId=${command.authentication.keyId}`,
    correlationId: command.idempotencyKey,
    after: saved,
  });
  return { disposition, leadId: saved.id };
}
