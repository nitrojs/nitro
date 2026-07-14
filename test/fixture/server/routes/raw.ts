// @ts-ignore
import sql from "raw:../files/sql.sql";

// https://github.com/nitrojs/nitro/issues/2836
// @ts-ignore
import sqlts from "../files/sqlts.sql";

// Resolved raw ids must not be claimed by the json plugins
// @ts-ignore
import json from "raw:../assets/test.json";

export default async () => {
  const jsonText = json as unknown as string;
  return {
    sql: sql.trim(),
    sqlts: sqlts.trim(),
    json: {
      isString: typeof jsonText === "string",
      text: jsonText.trim(),
    },
  };
};
