import type { AppEventBus, EventUnsubscribe } from "./AppEventBus";

export class BrowserEventBus implements AppEventBus {
  publish<TPayload = void>(eventName: string, payload?: TPayload): void {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent(eventName, { detail: payload }));
  }

  subscribe<TPayload = void>(eventName: string, listener: (payload: TPayload) => void): EventUnsubscribe {
    if (typeof window === "undefined") return () => undefined;

    const handler = (event: Event) => {
      listener((event as CustomEvent<TPayload>).detail);
    };

    window.addEventListener(eventName, handler);
    return () => window.removeEventListener(eventName, handler);
  }
}
