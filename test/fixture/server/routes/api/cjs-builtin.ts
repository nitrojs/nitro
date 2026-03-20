import { defineEventHandler } from "h3";
import builtin from "../../lib/cjs-builtin-require.mjs";

export default defineEventHandler(() => {
  return {
    ok: true,
    clientName: builtin.Client.name,
    eventEmitterType: typeof builtin.EventEmitter,
  };
});
