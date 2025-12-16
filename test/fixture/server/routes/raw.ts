// @ts-ignore
import sql from "raw:../files/sql.sql";

// https://github.com/nitrojs/nitro/issues/2836
// @ts-ignore
import sqlts from "../files/sqlts.sql";

export default async () => {
  return {
    sql: sql.trim(),
    sqlts: sqlts.trim(),
  };
};
