import type { Writable } from "node:stream";

export function writeTaskOutput(stream: Writable, text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    stream.write(text, (error) => (error ? reject(error) : resolve()));
  });
}

export function taskErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
