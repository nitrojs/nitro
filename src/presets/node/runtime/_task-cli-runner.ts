import "#nitro/virtual/polyfills";
import type { NitroApp, TaskPayload } from "nitro/types";
import { useNitroApp } from "nitro/app";
import { runTask } from "nitro/task";
import { rememberTaskApp } from "./_task-cli-close.ts";

export async function initializeTaskApp(): Promise<void> {
  let app: NitroApp | undefined;
  try {
    app = useNitroApp();
  } finally {
    // useNitroApp publishes the instance before a synchronous plugin can throw.
    rememberTaskApp(app ?? globalThis.__nitro__?.default);
  }
  await app?.ready;
}

export function executeTask(name: string, payload: TaskPayload) {
  return runTask(name, { payload });
}
