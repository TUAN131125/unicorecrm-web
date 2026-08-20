import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import { RouteModuleLoadError } from "./routeScreenErrors";

const DEFAULT_ROUTE_LOAD_TIMEOUT_MS = 15_000;

export function lazyRouteComponent<TModule, TComponent extends ComponentType<any>>(
  routeId: string,
  loader: () => Promise<TModule>,
  selectComponent: (module: TModule) => TComponent,
  timeoutMs = DEFAULT_ROUTE_LOAD_TIMEOUT_MS,
): LazyExoticComponent<TComponent> {
  return lazy(async () => {
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new RouteModuleLoadError(
          routeId,
          "TIMEOUT",
          `Route module "${routeId}" did not load within ${timeoutMs}ms.`,
        ));
      }, timeoutMs);
    });

    try {
      const loadedModule = await Promise.race([loader(), timeoutPromise]);
      const component = selectComponent(loadedModule);

      if (!component) {
        throw new RouteModuleLoadError(
          routeId,
          "MISSING_EXPORT",
          `Route module "${routeId}" loaded without the expected component export.`,
        );
      }

      return { default: component };
    } catch (error) {
      if (error instanceof RouteModuleLoadError) throw error;
      throw new RouteModuleLoadError(
        routeId,
        "IMPORT_FAILED",
        `Unable to load route module "${routeId}".`,
        error,
      );
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }
  });
}
