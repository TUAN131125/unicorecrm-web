import type { FrontendModuleManifest, ModuleKey } from "./types";

export class ModuleRegistry {
  private readonly manifests = new Map<ModuleKey, FrontendModuleManifest>();

  register(manifest: FrontendModuleManifest): this {
    if (this.manifests.has(manifest.key)) {
      throw new Error(`Frontend module "${manifest.key}" is already registered.`);
    }
    this.manifests.set(manifest.key, manifest);
    return this;
  }

  get(moduleKey: ModuleKey): FrontendModuleManifest | undefined {
    return this.manifests.get(moduleKey);
  }

  list(): readonly FrontendModuleManifest[] {
    return [...this.manifests.values()];
  }
}
