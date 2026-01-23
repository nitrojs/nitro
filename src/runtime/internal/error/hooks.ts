import { useNitroApp } from "../app.ts";

function _captureError(error: Error, type: string) {
  console.error(`[${type}]`, error);
  useNitroApp().captureError?.(error, { tags: [type] });
}

export function trapUnhandledErrors() {
  process.on("unhandledRejection", (error: Error) => _captureError(error, "unhandledRejection"));
  process.on("uncaughtException", (error: Error) => _captureError(error, "uncaughtException"));
}
