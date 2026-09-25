import type { SerializableOptions } from "../../src/types/_utils.ts";
import type { DatabaseConnectionConfigs, StorageMounts } from "nitro/types";

// Storage: options are mapped from the builtin driver name.
// Unknown driver names fall back to a custom driver with free-form options.
export const storage: StorageMounts = {
  data: { driver: "fs", base: "./data", ignore: ["**/node_modules/**"] },
  cache: { driver: "lru-cache", max: 1000 },
  memory: { driver: "memory" },
  custom: { driver: "./drivers/custom", anyOption: true },
  noLib: { driver: "fs", lib: null },
  // @ts-expect-error `watchOptions.ignored` matcher functions are not serializable
  matcher: { driver: "fs", watchOptions: { ignored: [(path: string) => path.length > 0] } },
  // @ts-expect-error a `RegExp` is not serializable
  regexp: { driver: "fs", watchOptions: { ignored: /node_modules/ } },
  // @ts-expect-error `lib` is provided by nitro
  lib: { driver: "fs", lib: () => import("chokidar") },
  // @ts-expect-error custom driver options are serialized too
  customFn: { driver: "./drivers/custom", transform: () => "x" },
};

// Database: options are mapped from the db0 connector name.
export const database: DatabaseConnectionConfigs = {
  default: { connector: "sqlite", options: { name: "db", cwd: "." } },
  // @ts-expect-error unknown connector
  invalid: { connector: "unknown-connector" },
  // @ts-expect-error `name` is a string option of the `sqlite` connector
  invalidOption: { connector: "sqlite", options: { name: 123 } },
};

// Connector options are unions intersected with their `lib` option and the third-party types they
// are built from are not installed here, so the mapping is checked against an equivalent shape.
type Lib = { connect(): void };
type ConnectorOptionsShape = ({ url: string } | { host?: string }) & {
  lib?: Lib | (() => Promise<Lib>);
};

export const connectorOptions: SerializableOptions<ConnectorOptionsShape> = { url: "", lib: null };

export const connectorLib: SerializableOptions<ConnectorOptionsShape> = {
  url: "",
  // @ts-expect-error `lib` is provided by nitro
  lib: () => Promise.resolve({ connect() {} }),
};

export const connectorLibMessage: SerializableOptions<ConnectorOptionsShape> = {
  url: "",
  // @ts-expect-error the message of a rejected option is not a value it accepts
  lib: "Library imports are not JSON-serializable; nitro injects them for installed driver dependencies (set `null` to opt out)",
};
