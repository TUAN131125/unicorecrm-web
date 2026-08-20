export interface ApplicationServiceBinding<TServices> {
  configure(services: TServices): void;
  get(): TServices;
  isConfigured(): boolean;
  reset(): void;
}

export function createApplicationServiceBinding<TServices>(name: string): ApplicationServiceBinding<TServices> {
  let current: TServices | undefined;

  return {
    configure(services) {
      current = services;
    },
    get() {
      if (!current) {
        throw new Error(`${name} application services have not been configured. Initialize the application composition root before using module operations.`);
      }
      return current;
    },
    isConfigured() {
      return current !== undefined;
    },
    reset() {
      current = undefined;
    },
  };
}

export function createApplicationServiceProxy<TService extends object>(resolve: () => TService): TService {
  return new Proxy({} as TService, {
    get(_target, property) {
      const service = resolve();
      const value = Reflect.get(service, property, service);
      return typeof value === "function" ? value.bind(service) : value;
    },
    set(_target, property, value) {
      return Reflect.set(resolve(), property, value);
    },
    has(_target, property) {
      return property in resolve();
    },
    ownKeys() {
      return Reflect.ownKeys(resolve());
    },
    getOwnPropertyDescriptor(_target, property) {
      return Object.getOwnPropertyDescriptor(resolve(), property) ?? { configurable: true, enumerable: true };
    },
  });
}
