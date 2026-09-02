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

  it("returns empty connection configs when database is disabled", () => {
    const template = database(
      createNitroStub({ default: { connector: "sqlite" } }, false)
    ).template();
    expect(template).toBe("export const connectionConfigs = {};");
  });

  it("imports the connector module", () => {
    const template = database(createNitroStub({ default: { connector: "sqlite" } })).template();
    expect(template).toContain(`import sqliteConnector from "db0/connectors/node-sqlite";`);
    expect(template).toContain("connector: sqliteConnector");
  });

  it("throws for an unknown connector", () => {
    expect(() =>
      database(createNitroStub({ default: { connector: "unknown" as any } })).template()
    ).toThrow(`Database connector "unknown" is invalid.`);
  });

  it("provides installed connector dependencies via the `lib` option", () => {
    installedDeps.add("pg");
    const template = database(
      createNitroStub({ default: { connector: "postgresql", options: { url: "postgres://" } } })
    ).template();
    expect(template).toContain(`options: { ...{"url":"postgres://"}, lib: () => import("pg") }`);
  });

  it("does not provide `lib` for dependencies that are not installed", () => {
    const template = database(
      createNitroStub({ default: { connector: "postgresql", options: { url: "postgres://" } } })
    ).template();
    expect(template).toContain(`options: {"url":"postgres://"}`);
    expect(template).not.toContain("import(");
  });

  it("does not override a user provided `lib` option", () => {
    installedDeps.add("pg");
    const template = database(
      createNitroStub({ default: { connector: "postgresql", options: { lib: null } } })
    ).template();
    expect(template).not.toContain(`import("pg")`);
  });
});
