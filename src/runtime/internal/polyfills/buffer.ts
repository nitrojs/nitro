import { Buffer } from "node:buffer";

if (!globalThis.Buffer) {
  globalThis.Buffer = Buffer;
}
