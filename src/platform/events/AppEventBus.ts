export type EventUnsubscribe = () => void;

export interface AppEventBus {
  publish<TPayload = void>(eventName: string, payload?: TPayload): void;
  subscribe<TPayload = void>(eventName: string, listener: (payload: TPayload) => void): EventUnsubscribe;
}
