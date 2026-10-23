import { FastResponse } from "srvx";

if (globalThis.Response !== FastResponse) {
  globalThis.Response = FastResponse;
}
