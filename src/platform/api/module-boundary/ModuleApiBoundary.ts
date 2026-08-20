import type { ApiOperationId } from "../catalog/generatedApiOperationCatalog";

export interface ApiOperationBinding<TOperationId extends ApiOperationId = ApiOperationId> {
  readonly operationId: TOperationId;
}

export type ModuleQueryPort = Readonly<Record<string, (...args: never[]) => Promise<unknown>>>;
export type ModuleCommandPort = Readonly<Record<string, (...args: never[]) => Promise<unknown>>>;

export interface ConnectedModuleApiRuntime<
  TQueries extends ModuleQueryPort,
  TCommands extends ModuleCommandPort,
> {
  readonly mode: "connected";
  readonly queries: TQueries;
  readonly commands: TCommands;
}

export interface DemoModuleApiRuntime<
  TQueries extends ModuleQueryPort,
  TCommands extends ModuleCommandPort,
> {
  readonly mode: "demo";
  readonly queries: TQueries;
  readonly commands: TCommands;
}

export type ModuleApiRuntime<
  TQueries extends ModuleQueryPort,
  TCommands extends ModuleCommandPort,
> = ConnectedModuleApiRuntime<TQueries, TCommands> | DemoModuleApiRuntime<TQueries, TCommands>;
