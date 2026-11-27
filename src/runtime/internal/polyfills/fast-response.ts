import { FastResponse } from "srvx";

if (!("Bun" in globalThis) && globalThis.Response !== FastResponse) {
  globalThis.Response = FastResponse;
}
