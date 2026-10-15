import "./_runtime_warn.ts";
import type { Connector, Database } from "db0";

export const connectionConfigs: {
  [name: string]: {
    connector: (options: any) => Connector;
    options: any;
  };
} = {};

export const traceDatabase: (db: Database) => Database = (db) => db;
