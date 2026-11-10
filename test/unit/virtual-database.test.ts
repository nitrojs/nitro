import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Nitro } from "nitro/types";

const installedDeps = new Set<string>();

vi.mock("../../src/utils/dep.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/utils/dep.ts")>()),
  isDepInstalled: (id: string) => installedDeps.has(id),
}));

const { default: database } = await import("../../src/build/virtual/database.ts");

function createNitroStub(db: Nitro["options"]["database"] | undefined, enabled = true): Nitro {
  return {
    options: {
      dev: false,
      rootDir: process.cwd(),
      database: db,
      devDatabase: undefined,
      experimental: { database: enabled },
    },
  } as unknown as Nitro;
}

describe("virtual/database template", () => {
  beforeEach(() => {
    installedDeps.clear();
  });

  it("returns empty connection configs when database is disabled", async () => {
    const template = await database(
      createNitroStub({ default: { connector: "sqlite" } }, false)
    ).template();
    expect(template).toContain("export const connectionConfigs = {};");
    expect(template).toContain("export const traceDatabase = (db) => db;");
  });

  it("imports the connector module", async () => {
    const template = await database(
      createNitroStub({ default: { connector: "sqlite" } })
    ).template();
    expect(template).toContain(`import sqliteConnector from "db0/connectors/node-sqlite";`);
    expect(template).toContain("connector: sqliteConnector");
  });

  it("throws for an unknown connector", async () => {
    await expect(
      database(createNitroStub({ default: { connector: "unknown" as any } })).template()
    ).rejects.toThrow(`Database connector "unknown" is invalid.`);
  });

  it("provides installed connector dependencies via the `lib` option", async () => {
    installedDeps.add("pg");
    const template = await database(
      createNitroStub({ default: { connector: "postgresql", options: { url: "postgres://" } } })
    ).template();
    expect(template).toContain(`options: { ...{"url":"postgres://"}, lib: () => import("pg") }`);
  });

  it("uses the connector import specifier when it differs from the package name", async () => {
    installedDeps.add("mysql2");
    const template = await database(
      createNitroStub({ default: { connector: "mysql2", options: { host: "localhost" } } })
    ).template();
    expect(template).toContain(
      `options: { ...{"host":"localhost"}, lib: () => import("mysql2/promise") }`
    );
  });

  it("does not provide `lib` for dependencies that are not installed", async () => {
    const template = await database(
      createNitroStub({ default: { connector: "postgresql", options: { url: "postgres://" } } })
    ).template();
    expect(template).toContain(`options: {"url":"postgres://"}`);
    expect(template).not.toContain("import(");
  });

  it("does not override a user provided `lib` option", async () => {
    installedDeps.add("pg");
    const template = await database(
      createNitroStub({ default: { connector: "postgresql", options: { lib: null } } })
    ).template();
    expect(template).not.toContain(`import("pg")`);
  });

  it("does not trace queries when tracingChannel is disabled", async () => {
    const template = await database(
      createNitroStub({ default: { connector: "sqlite" } })
    ).template();
    expect(template).toContain("export const traceDatabase = (db) => db;");
    expect(template).not.toContain("db0/tracing");
  });

  it("does not trace queries when tracingChannel.db0 is disabled", async () => {
    const nitro = createNitroStub({ default: { connector: "sqlite" } });
    nitro.options.tracingChannel = { h3: true, srvx: true, unstorage: true, db0: false };
    const template = await database(nitro).template();
    expect(template).toContain("export const traceDatabase = (db) => db;");
    expect(template).not.toContain("db0/tracing");
  });

  it("traces queries when tracingChannel.db0 is enabled", async () => {
    const nitro = createNitroStub({ default: { connector: "sqlite" } });
    nitro.options.tracingChannel = { db0: true };
    const template = await database(nitro).template();
    expect(template).toContain(`export { withTracing as traceDatabase } from "db0/tracing";`);
    expect(template).not.toContain("export const traceDatabase");
  });
});
