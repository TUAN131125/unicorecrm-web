export type RouteModuleFailureReason = "IMPORT_FAILED" | "TIMEOUT" | "MISSING_EXPORT";
export type RouteScreenErrorKind = "MODULE_LOAD" | "CONFIGURATION" | "RENDER";

export class RouteModuleLoadError extends Error {
  readonly code = "ROUTE_MODULE_LOAD_FAILED";

  constructor(
    readonly routeId: string,
    readonly reason: RouteModuleFailureReason,
    message: string,
    cause?: unknown,
  ) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "RouteModuleLoadError";
  }
}

interface ErrorWithCode {
  code?: unknown;
}

export function isRouteModuleLoadError(error: unknown): error is RouteModuleLoadError {
  if (error instanceof RouteModuleLoadError) return true;
  if (!error || typeof error !== "object") return false;
  const candidate = error as Partial<RouteModuleLoadError>;
  return candidate.name === "RouteModuleLoadError"
    && candidate.code === "ROUTE_MODULE_LOAD_FAILED"
    && typeof candidate.routeId === "string";
}

export function classifyRouteScreenError(error: unknown): RouteScreenErrorKind {
  if (isRouteModuleLoadError(error)) return "MODULE_LOAD";
  if (error && typeof error === "object") {
    const code = (error as ErrorWithCode).code;
    if (typeof code === "string" && (
      code.startsWith("CONFIGURATION_")
      || code.endsWith("_CONFIGURATION_INVALID")
      || code === "STUDIO_CONFIGURATION_INVALID"
    )) return "CONFIGURATION";
  }
  return "RENDER";
}
