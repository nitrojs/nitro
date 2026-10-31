import { watch } from "node:fs";
import { readFile } from "node:fs/promises";

export interface Event {
  stage: string;
  pid: number;
}

export function observeEvents(path: string, notify: () => void, abort: () => void) {
  const events: Event[] = [];
  let pending = Promise.resolve();
  let error: unknown;
  const fail = (cause: unknown) => {
    error = cause;
    abort();
    notify();
  };
  const refresh = () => {
    pending = pending.then(async () => {
      try {
        events.splice(0, events.length, ...parseEvents(await readFile(path, "utf8")));
      } catch (cause) {
        fail(cause);
      }
      notify();
    });
  };
  const watcher = watch(path, refresh);
  watcher.on("error", fail);
  refresh();
  return {
    events,
    get error() {
      return error;
    },
    close: () => watcher.close(),
    async finish() {
      watcher.close();
      await pending;
      if (error) throw error;
      events.splice(0, events.length, ...parseEvents(await readFile(path, "utf8")));
      return events;
    },
  };
}

function parseEvents(text: string): Event[] {
  return text
    .slice(0, text.lastIndexOf("\n") + 1)
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}
