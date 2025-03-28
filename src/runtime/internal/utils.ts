import type { Readable } from "node:stream";
import { useNitroApp } from "./app";

function _captureError(error: Error, type: string) {
  console.error(`[${type}]`, error);
  useNitroApp().captureError(error, { tags: [type] });
}

export function trapUnhandledNodeErrors() {
  process.on("unhandledRejection", (error: Error) =>
    _captureError(error, "unhandledRejection")
  );
  process.on("uncaughtException", (error: Error) =>
    _captureError(error, "uncaughtException")
  );
}
