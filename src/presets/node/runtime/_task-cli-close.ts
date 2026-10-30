import type { NitroApp } from "nitro/types";

let app: NitroApp | undefined;
let closePromise: Promise<void> | undefined;

export function rememberTaskApp(instance: NitroApp | undefined): void {
  app ??= instance;
}

export function closeTaskApp(): Promise<void> {
  return (closePromise ??= Promise.resolve().then(() => {
    const existing = app ?? globalThis.__nitro__?.default;
    return existing?.hooks?.callHook("close");
  }));
}
