import { clearImmediate, setImmediate } from "node:timers";

if (!globalThis.setImmediate) {
  globalThis.setImmediate = setImmediate;
}

if (!globalThis.clearImmediate) {
  globalThis.clearImmediate = clearImmediate;
}
