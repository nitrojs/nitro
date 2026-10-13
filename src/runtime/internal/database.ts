import type { Database } from "db0";
import { createDatabase } from "db0";
import { connectionConfigs } from "#nitro/virtual/database";

const instances: Record<string, Database> = Object.create(null);

export function useDatabase(name = "default"): Database {
  if (instances[name]) {
    return instances[name];
  }
  if (!connectionConfigs[name]) {
    throw new Error(`Database connection "${name}" not configured.`);
  }
  return (instances[name] = createDatabase(
    connectionConfigs[name].connector(connectionConfigs[name].options || {})
  ));
}
