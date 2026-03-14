import { useNitroApp } from "../app.ts";

function _captureError(error: Error, type: string): void {
  console.error(`[${type}]`, error);
  useNitroApp().captureError?.(error, { tags: [type] });
}

export function trapUnhandledErrors(): void {
  process.on("unhandledRejection", (error: Error) => _captureError(error, "unhandledRejection"));
  process.on("uncaughtException", (error: Error) => _captureError(error, "uncaughtException"));
}
