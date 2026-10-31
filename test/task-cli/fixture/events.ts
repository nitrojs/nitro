import { appendFileSync } from "node:fs";
import type { NitroApp } from "nitro/types";

declare global {
  var __taskCliFixtureApp: NitroApp | undefined;
  var __taskCliRejectPending: ((error: Error) => void) | undefined;
}

export let ready = false;

export function mark(stage: string) {
  const event = { stage, pid: process.pid };
  if (process.env.TASK_CLI_EVENTS) {
    appendFileSync(process.env.TASK_CLI_EVENTS, JSON.stringify(event) + "\n");
  }
  if (process.env.TASK_CLI_EVENTS && process.connected) {
    process.send?.(event);
  }
}

export function setReady() {
  ready = true;
}

export function waitForRelease() {
  return new Promise<void>((resolve) => {
    const listener = (message: unknown) => {
      if (message === "release") {
        process.off("message", listener);
        resolve();
      }
    };
    process.on("message", listener);
  });
}
