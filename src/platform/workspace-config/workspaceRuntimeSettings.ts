import { useSyncExternalStore } from "react";
import { getAuthSessionSnapshot } from "@/platform/identity-auth";
import type { WorkspaceBootstrapContext } from "@/platform/workspace-context/domain/workspaceBootstrap.types";
import { ApplicationError } from "@/shared/domain";
import type { WorkspaceOperationalConfiguration } from "./workspaceOperationalConfiguration.types";

export interface WorkspaceRuntimeSettings {
  workspaceId: string;
  baseCurrency: string;
  timeZone: string;
  configurationVersion: number;
  source: "BOOTSTRAP" | "STUDIO" | "DEMO";
  studioRevision?: number;
}

export interface WorkspaceConfigurationOwner {
  generation: number;
  session: string;
  workspaceId?: string;
}

let connected = false;
let generation = 0;
let revision = 0;
let settings: WorkspaceRuntimeSettings | undefined;
let ownerSession: string | undefined;
const listeners = new Set<() => void>();
let readDemo: (() => WorkspaceOperationalConfiguration) | undefined;

export function configureDemoWorkspaceRuntimeSettingsReader(reader: () => WorkspaceOperationalConfiguration): void { readDemo = reader; }
export function notifyDemoWorkspaceRuntimeSettings(): void { if (!connected) emit(); }

function sessionKey(): string {
  const session = getAuthSessionSnapshot();
  return JSON.stringify([session?.sessionId, session?.principal.accountId]);
}

export function configureWorkspaceRuntimeSettings(isConnected: boolean): void {
  if (connected === isConnected) return;
  connected = isConnected;
  retireWorkspaceRuntimeSettings();
}

export function retireWorkspaceRuntimeSettings(): WorkspaceConfigurationOwner {
  generation += 1;
  settings = undefined;
  ownerSession = undefined;
  emit();
  return { generation, session: sessionKey() };
}

export function prepareWorkspaceRuntimeSettings(context: WorkspaceBootstrapContext, owner: WorkspaceConfigurationOwner): () => void {
  validate(context.configuration.baseCurrency, context.configuration.timeZone);
  if (!Number.isSafeInteger(context.configuration.configurationVersion) || context.configuration.configurationVersion < 0) throw unavailable();
  return () => {
    assertWorkspaceRuntimeSettingsEntry(owner);
    settings = {
      workspaceId: context.workspace.workspaceId,
      baseCurrency: context.configuration.baseCurrency,
      timeZone: context.configuration.timeZone,
      configurationVersion: context.configuration.configurationVersion,
      source: "BOOTSTRAP",
    };
    ownerSession = owner.session;
    emit();
  };
}

export function assertWorkspaceRuntimeSettingsEntry(owner: WorkspaceConfigurationOwner): void {
  if (owner.generation !== generation || owner.session !== sessionKey()) throw unavailable();
}

export function captureWorkspaceConfigurationOwner(): WorkspaceConfigurationOwner {
  const value = connected ? getWorkspaceRuntimeSettings() : undefined;
  return { generation, session: sessionKey(), ...(value ? { workspaceId: value.workspaceId } : {}) };
}

export function isCurrentWorkspaceConfigurationOwner(owner: WorkspaceConfigurationOwner): boolean {
  return owner.generation === generation && owner.session === sessionKey()
    && (!connected || (ownerSession === owner.session && settings?.workspaceId === owner.workspaceId));
}

export function publishWorkspaceRuntimeLocale(baseCurrency: string, timeZone: string, owner: WorkspaceConfigurationOwner, studioRevision: number): void {
  if (!connected) return;
  if (!isCurrentWorkspaceConfigurationOwner(owner) || !settings) throw unavailable();
  validate(baseCurrency, timeZone);
  // Studio revision and Bootstrap configurationVersion are different counters.
  settings = { ...settings, baseCurrency, timeZone, source: "STUDIO", studioRevision };
  emit();
}

export function isConnectedWorkspaceRuntimeSettings(): boolean { return connected; }
export function isWorkspaceRuntimeSettingsReady(): boolean { return !connected || (settings !== undefined && ownerSession === sessionKey()); }
export function getWorkspaceRuntimeSettingsRevision(): number { return revision; }

export function getWorkspaceRuntimeSettings(): WorkspaceRuntimeSettings {
  if (!connected) {
    const value = readDemo?.();
    if (!value) throw unavailable();
    return { workspaceId: "demo", baseCurrency: value.localeRegion.currencies.baseCurrency,
      timeZone: value.localeRegion.timezone, configurationVersion: value.revision, source: "DEMO" };
  }
  if (!settings || ownerSession !== sessionKey()) throw unavailable();
  return { ...settings };
}

export function subscribeToWorkspaceRuntimeSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useWorkspaceRuntimeSettings(): WorkspaceRuntimeSettings {
  useSyncExternalStore(subscribeToWorkspaceRuntimeSettings, getWorkspaceRuntimeSettingsRevision);
  return getWorkspaceRuntimeSettings();
}

function emit(): void { revision += 1; listeners.forEach((listener) => listener()); }
function unavailable(): ApplicationError {
  return new ApplicationError({ code: "WORKSPACE_CONFIGURATION_UNAVAILABLE", category: "INFRASTRUCTURE",
    message: "Workspace configuration authority is unavailable.", retryable: true });
}
function validate(currency: string, timeZone: string): void {
  if (!/^[A-Z]{3}$/u.test(currency)) throw unavailable();
  if (typeof timeZone !== "string" || !timeZone.trim()) throw unavailable();
  try { new Intl.DateTimeFormat("en", { timeZone }).format(); } catch { throw unavailable(); }
}
