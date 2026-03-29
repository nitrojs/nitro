import SchemaBuilder from "@pothos/core";
import type { H3Event } from "nitro/h3";

export const builder = new SchemaBuilder<{
  Context: { event: H3Event };
}>({});
builder.queryType({});
// builder.mutationType({})
// builder.subscriptionType({})

// Do not include in production
if (import.meta.dev) {
  // Tell vite to reload the builder when schema changes
  // https://github.com/hayes/pothos/issues/49#issuecomment-836056530
  import("./schema");
}
