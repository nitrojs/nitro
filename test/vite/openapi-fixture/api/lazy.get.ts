import { defineValidatedHandler } from "nitro/h3";
import { z } from "zod";
import { query } from "../utils/lazy-dependency.ts";
import { state } from "../utils/lazy-state.ts";

state.route++;

export default defineValidatedHandler({
  validate: { query: z.object({ id: z.string().optional() }) },
  handler: () => query(),
});
