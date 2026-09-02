import type { DatabaseConnectionConfigs, StorageMounts } from "nitro/types";

// Storage: options are mapped from the builtin driver name.
// Unknown driver names fall back to a custom driver with free-form options.
export const storage: StorageMounts = {
  data: { driver: "fs", base: "./data" },
  cache: { driver: "lru-cache", max: 1000 },
  memory: { driver: "memory" },
  custom: { driver: "./drivers/custom", anyOption: true },
};

// Database: options are mapped from the db0 connector name.
export const database: DatabaseConnectionConfigs = {
  default: { connector: "sqlite", options: { name: "db", cwd: "." } },
  // @ts-expect-error unknown connector
  invalid: { connector: "unknown-connector" },
  // @ts-expect-error `name` is a string option of the `sqlite` connector
  invalidOption: { connector: "sqlite", options: { name: 123 } },
};
