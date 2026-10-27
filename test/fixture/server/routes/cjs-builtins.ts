// @ts-ignore
import cjsBuiltins from "nitro-cjs-builtins";
// Builtins by their bare id (`buffer/` is aliased to `node:buffer` like the `buffer` package)
import { EventEmitter } from "events";
// @ts-ignore
import { Buffer } from "buffer/";

export default () =>
  new EventEmitter() instanceof EventEmitter && Buffer.from("ok").toString() === "ok"
    ? cjsBuiltins
    : "fail";
