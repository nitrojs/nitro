import type { Nitro } from "nitro/types";
import type { RollupOutput } from "rollup";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("nitro/meta", () => ({ version: "0.0.0" }));
vi.mock("nitro/types", () => ({}));
vi.mock("node:fs/promises", () => ({ mkdir: vi.fn(), readFile: vi.fn(), stat: vi.fn() }));
vi.mock("../../src/utils/fs.ts", () => ({ writeFile: vi.fn() }));

import { writeBuildInfo } from "../../src/build/info.ts";
import { writeFile } from "../../src/utils/fs.ts";

describe("writeBuildInfo", () => {
  afterEach(() => {
    vi.mocked(writeFile).mockClear();
  });

  it("records Nitro's entry when a plugin entry appears first", async () => {
    const buildInfo = await writeBuildInfo(
      {
        options: {
          rootDir: "/project",
          entry: "/project/server",
          output: {
            dir: "/project/.output",
            serverDir: "/project/.output/server",
            publicDir: "/project/.output/public",
          },
          commands: {},
        },
      } as Nitro,
      {
        output: [
          {
            type: "chunk",
            isEntry: true,
            fileName: "plugin-entry.mjs",
            facadeModuleId: "/plugin/entry.ts",
          },
          {
            type: "chunk",
            isEntry: true,
            fileName: "index.mjs",
            facadeModuleId: "/project/server.ts",
          },
        ],
      } as unknown as RollupOutput
    );

    expect(buildInfo.serverEntry).toBe("server/index.mjs");
    expect(writeFile).toHaveBeenCalledWith(
      "/project/.output/nitro.json",
      expect.stringContaining('"serverEntry": "server/index.mjs"'),
      true
    );
  });

  it("records Nitro's entry when a preset uses a non-default file name", async () => {
    const buildInfo = await writeBuildInfo(
      {
        options: {
          rootDir: "/project",
          entry: "/project/server",
          output: {
            dir: "/project/.output",
            serverDir: "/project/.output/server",
            publicDir: "/project/.output/public",
          },
          commands: {},
        },
      } as Nitro,
      {
        output: [
          {
            type: "chunk",
            isEntry: true,
            fileName: "plugin-entry.mjs",
            facadeModuleId: "/plugin/entry.ts",
          },
          {
            type: "chunk",
            isEntry: true,
            fileName: "worker.mjs",
            facadeModuleId: "/project/server.ts",
          },
        ],
      } as unknown as RollupOutput
    );

    expect(buildInfo.serverEntry).toBe("server/worker.mjs");
  });
});
