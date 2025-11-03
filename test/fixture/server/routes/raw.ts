// @ts-ignore
import sql from "../files/sql.sql";

// https://github.com/nitrojs/nitro/issues/2836
import sqlts from "../files/sqlts.sql";

export default defineHandler(async () => {
  return {
    sql: sql.trim(),
    sqlts: sqlts.trim(),
  };
});
