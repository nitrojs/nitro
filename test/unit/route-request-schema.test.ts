import { describe, expect, it } from "vitest";
import { parseAst } from "rollup/parseAst";
import { extractRouteValidation } from "../../src/build/plugins/_route-request-schema.ts";

describe("route request schema extraction", () => {
  it.each([
    "const connection = await db.connect();",
    "const { connection = db.connect() } = {};",
    "const [connection = db.connect()] = [];",
  ])("does not evaluate handler initialization: %s", async (initialization) => {
    const dependency = moduleURL(
      'throw new Error("handler dependency loaded"); export const db = {};'
    );
    const schema = await extract(`
      import { db } from ${JSON.stringify(dependency)};
      ${initialization}
      throw new Error("route evaluated");
      const Query = makeSchema("id");
      function makeSchema(db) { return { [db]: { type: "string" } }; }
      export default defineValidatedHandler({
        validate: { query: Query },
        handler: () => db.connect(),
      });
    `);

    expect(schema).toEqual({ query: { id: { type: "string" } } });
  });

  it("preserves imported bindings, closures, destructuring and awaited schema initialization", async () => {
    const dependency = moduleURL('export const field = { type: "string" };');
    const schema = await extract(`
      import { field as id } from ${JSON.stringify(dependency)};
      const { Query } = await Promise.resolve({ Query: makeSchema() });
      function makeSchema() { return { id }; }
      export default defineValidatedHandler({ validate: { query: Query }, handler: () => null });
    `);

    expect(schema).toEqual({ query: { id: { type: "string" } } });
  });
});

async function extract(code: string) {
  const output = await extractRouteValidation(code, { ast: parseAst(code) });
  return (await import(/* @vite-ignore */ moduleURL(output))).default;
}

function moduleURL(code: string) {
  return `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
}
