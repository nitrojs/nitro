// @ts-ignore
import sql from "raw:../files/sql.sql";

// https://github.com/nitrojs/nitro/issues/2836
// @ts-ignore
import sqlts from "../files/sqlts.sql";

// Resolved raw ids must not be claimed by the json plugins
// @ts-ignore
import json from "raw:../assets/test.json";

// Virtual modules have no file to read: their rendered source is inlined
// @ts-ignore
import virtualText from "#nitro/virtual/feature-flags" with { type: "text" };
// @ts-ignore
import virtualBytes from "#nitro/virtual/feature-flags" with { type: "bytes" };

export default async () => {
  const jsonText = json as unknown as string;
  const virtualSource = virtualText as unknown as string;
  return {
    sql: sql.trim(),
    sqlts: sqlts.trim(),
    json: {
      isString: typeof jsonText === "string",
      text: jsonText.trim(),
    },
    virtual: {
      isString: typeof virtualSource === "string",
      hasFlag: virtualSource.includes("hasRoutes"),
      isUint8Array: (virtualBytes as unknown) instanceof Uint8Array,
      bytesHaveFlag: new TextDecoder()
        .decode(virtualBytes as unknown as Uint8Array)
        .includes("hasRoutes"),
    },
  };
};
