import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "pathe";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NitroConfig } from "nitro/types";

vi.mock("nitro/meta", () => ({
  version: "0.0.0-test",
  runtimeDir: "/tmp",
  presetsDir: "/tmp",
  pkgDir: "/tmp",
  runtimeDependencies: [],
}));

const tempDirs: string[] = [];

async function createRootDir(configSource?: string) {
  const rootDir = await mkdtemp(join(tmpdir(), "nitro-config-extends-"));
  tempDirs.push(rootDir);
  if (configSource) {
    await writeFile(join(rootDir, "nitro.config.ts"), configSource);
  }
  return rootDir;
}

async function load(overrides: NitroConfig) {
  const { loadOptions } = await import("../../src/config/loader.ts");
  return loadOptions({ preset: "node-server", ...overrides });
}

afterEach(async () => {
  vi.restoreAllMocks();
  for (const dir of tempDirs.splice(0, tempDirs.length)) {
    await rm(dir, { recursive: true, force: true });
  }
});

describe("config loader inline extends", () => {
  it("extends from an inline object passed as overrides", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const rootDir = await createRootDir();

    const options = await load({
      rootDir,
      extends: { runtimeConfig: { fromBase: "base" } },
      runtimeConfig: { fromMain: "main" },
    });

    expect(options.runtimeConfig.fromBase).toBe("base");
    expect(options.runtimeConfig.fromMain).toBe("main");
    expect(warn).not.toHaveBeenCalled();
  });

  it("extends from an inline object in the config file", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const rootDir = await createRootDir(`export default defineNitroConfig({
  extends: { runtimeConfig: { fromBase: "base" } },
  runtimeConfig: { fromMain: "main" },
})
`);

    const options = await load({ rootDir });

    expect(options.runtimeConfig.fromBase).toBe("base");
    expect(options.runtimeConfig.fromMain).toBe("main");
    expect(warn).not.toHaveBeenCalled();
  });

  it("lets overrides win over an inline object", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const rootDir = await createRootDir();

    const options = await load({
      rootDir,
      extends: { runtimeConfig: { shared: "base" } },
      runtimeConfig: { shared: "main" },
    });

    expect(options.runtimeConfig.shared).toBe("main");
    expect(warn).not.toHaveBeenCalled();
  });

  it("replaces the config file's extends with an inline object from overrides", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const rootDir = await createRootDir(`export default defineNitroConfig({
  extends: "./base.config.ts",
})
`);
    await writeFile(
      join(rootDir, "base.config.ts"),
      `export default { runtimeConfig: { fromFile: "file" } }\n`
    );

    const options = await load({
      rootDir,
      extends: { runtimeConfig: { fromInline: "inline" } },
    });

    expect(options.runtimeConfig.fromInline).toBe("inline");
    // Same as a string `extends` in overrides, which replaces the config file's one
    expect(options.runtimeConfig.fromFile).toBeUndefined();
    expect(warn).not.toHaveBeenCalled();
  });

  it("extends from an inline function", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const rootDir = await createRootDir();

    const options = await load({
      rootDir,
      extends: () => ({ runtimeConfig: { fromFunction: "function" } }),
    });

    expect(options.runtimeConfig.fromFunction).toBe("function");
    expect(warn).not.toHaveBeenCalled();
  });

  it("extends from a nested inline object", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const rootDir = await createRootDir();

    const options = await load({
      rootDir,
      extends: {
        extends: { runtimeConfig: { fromRoot: "root" } },
        runtimeConfig: { fromBase: "base" },
      },
    });

    expect(options.runtimeConfig.fromRoot).toBe("root");
    expect(options.runtimeConfig.fromBase).toBe("base");
    expect(warn).not.toHaveBeenCalled();
  });
});

describe("config loader extends without inline objects", () => {
  async function writeSources(rootDir: string, names: string[]) {
    for (const name of names) {
      await writeFile(
        join(rootDir, `${name}.config.ts`),
        `export default { runtimeConfig: { shared: "${name}", from_${name}: "${name}" } }\n`
      );
    }
  }

  it("keeps only the overrides extends when both are strings", async () => {
    const rootDir = await createRootDir(`export default defineNitroConfig({
  extends: "./b.config.ts",
})
`);
    await writeSources(rootDir, ["a", "b"]);

    const options = await load({ rootDir, extends: "./a.config.ts" });

    expect(options.runtimeConfig.from_a).toBe("a");
    expect(options.runtimeConfig.from_b).toBeUndefined();
  });

  it("concatenates array sources with overrides first", async () => {
    const rootDir = await createRootDir(`export default defineNitroConfig({
  extends: ["./b.config.ts", "./c.config.ts"],
})
`);
    await writeSources(rootDir, ["a", "b", "c"]);

    const options = await load({ rootDir, extends: ["./a.config.ts"] });

    expect(options.runtimeConfig.from_a).toBe("a");
    expect(options.runtimeConfig.from_b).toBe("b");
    expect(options.runtimeConfig.from_c).toBe("c");
    expect(options.runtimeConfig.shared).toBe("a");
  });

  it("extends from the rc file", async () => {
    const rootDir = await createRootDir();
    await writeFile(join(rootDir, ".nitrorc"), "extends=./rc.config.ts\n");
    await writeSources(rootDir, ["rc"]);

    const options = await load({ rootDir });

    expect(options.runtimeConfig.from_rc).toBe("rc");
  });

  it("extends from a source with options", async () => {
    const rootDir = await createRootDir(`export default defineNitroConfig({
  extends: [["./a.config.ts", {}]],
})
`);
    await writeSources(rootDir, ["a"]);

    const options = await load({ rootDir });

    expect(options.runtimeConfig.from_a).toBe("a");
  });

  it("extends from a source object", async () => {
    const rootDir = await createRootDir(`export default defineNitroConfig({
  extends: { source: "./a.config.ts" },
})
`);
    await writeSources(rootDir, ["a"]);

    const options = await load({ rootDir });

    expect(options.runtimeConfig.from_a).toBe("a");
  });

  it("keeps extends in the config file layer", async () => {
    const rootDir = await createRootDir(`export default defineNitroConfig({
  extends: "./a.config.ts",
})
`);
    await writeSources(rootDir, ["a"]);

    const options = await load({ rootDir });

    expect(options._c12.layers?.some((layer) => layer.config?.extends === "./a.config.ts")).toBe(
      true
    );
  });
});
