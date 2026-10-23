import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Database } from "db0";
import { withTracing } from "db0/tracing";
import type { SpanInfo } from "../../src/runtime/internal/telemetry/types.ts";
import { TRACED_CHANNELS } from "../../src/runtime/internal/telemetry/channels.ts";
import { subscribeTracedChannels } from "../../src/runtime/internal/telemetry/subscribe.ts";

const SECRET = "s3cr3t-user-input";

const spans: SpanInfo[] = [];

beforeAll(() => {
  subscribeTracedChannels((info) => {
    spans.push(info);
  });
});

beforeEach(() => {
  spans.length = 0;
});

describe("db0.query describer", () => {
  it("names the span after the method and dialect", () => {
    const info = TRACED_CHANNELS["db0.query"]!("db0.query", {
      query: `SELECT * FROM users WHERE name = '${SECRET}'`,
      method: "exec",
      dialect: "sqlite",
    });

    expect(info).toEqual({
      name: "exec sqlite",
      kind: 3,
      attributes: [
        { key: "db.operation", value: { stringValue: "exec" } },
        { key: "db.system", value: { stringValue: "sqlite" } },
      ],
    });
  });

  it("falls back to the method when the dialect is unknown", () => {
    const info = TRACED_CHANNELS["db0.query"]!("db0.query", { query: "", method: "sql" });
    expect(info.name).toBe("sql");
    expect(info.attributes).toEqual([{ key: "db.operation", value: { stringValue: "sql" } }]);
  });
});

describe("db0.query tracing", () => {
  it("reports queries of a traced database without the query text", async () => {
    const db = withTracing({
      connector: { name: "fake" },
      dialect: "sqlite",
      exec: async () => ({ success: true }),
      sql: async () => ({ rows: [] }),
      prepare: () => ({
        bind: () => ({ all: async () => [] }),
      }),
    } as unknown as Database);

    await db.exec(`INSERT INTO users (name) VALUES ('${SECRET}')`);
    await db.sql`SELECT * FROM users WHERE name = ${SECRET}`;
    await db.prepare("SELECT * FROM users WHERE name = ?").bind(SECRET).all();

    expect(spans.map((span) => span.name)).toEqual([
      "exec sqlite",
      "sql sqlite",
      "prepare.all sqlite",
    ]);
    expect(JSON.stringify(spans)).not.toContain(SECRET);
    expect(JSON.stringify(spans)).not.toContain("SELECT");
  });
});
