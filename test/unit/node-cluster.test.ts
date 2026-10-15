import { describe, expect, it, vi } from "vitest";

vi.mock("nitro/meta", () => ({
  version: "0.0.0-test",
  runtimeDir: "/tmp",
  presetsDir: "/tmp",
  pkgDir: "/tmp",
  runtimeDependencies: [],
}));

const writeFileMock = vi.fn();
vi.mock("../../src/utils/fs.ts", () => ({
  writeFile: (path: string, content: string) => writeFileMock(path, content),
}));

describe("nodeCluster preset", () => {
  it("generates entry script using os.availableParallelism to respect container CPU limits", async () => {
    const { nodeCluster } = await import("../../src/presets/node/cluster.ts");
    writeFileMock.mockClear();

    const mockNitro = {
      options: {
        output: {
          serverDir: "/tmp/nitro-cluster-test",
        },
      },
    };

    const compiledHook = nodeCluster.hooks?.compiled;
    expect(compiledHook).toBeDefined();

    await compiledHook!(mockNitro as any);

    expect(writeFileMock).toHaveBeenCalledTimes(1);
    const [path, content] = writeFileMock.mock.calls[0];
    expect(path).toBe("/tmp/nitro-cluster-test/index.mjs");

    // Must use os.availableParallelism for container CPU awareness
    expect(content).toContain("availableParallelism");
    expect(content).toContain("os.availableParallelism");
  });

  it("calculates correct worker count with os.availableParallelism and env override", () => {
    function resolveWorkers(
      envWorkers: string | undefined,
      mockOs: { availableParallelism?: () => number; cpus: () => { length: number } }
    ) {
      return (
        Number.parseInt(envWorkers || "") ||
        (typeof mockOs.availableParallelism === "function"
          ? mockOs.availableParallelism()
          : mockOs.cpus().length > 0
            ? mockOs.cpus().length
            : 1)
      );
    }

    // When running inside container with CPU limit, availableParallelism returns container CPUs
    expect(
      resolveWorkers(undefined, {
        availableParallelism: () => 4,
        cpus: () => ({ length: 28 }), // Host has 28 CPUs
      })
    ).toBe(4);

    // Explicit env var NITRO_CLUSTER_WORKERS takes precedence
    expect(
      resolveWorkers("2", {
        availableParallelism: () => 4,
        cpus: () => ({ length: 28 }),
      })
    ).toBe(2);

    // Fallback when availableParallelism is not available (older Node runtimes)
    expect(
      resolveWorkers(undefined, {
        cpus: () => ({ length: 8 }),
      })
    ).toBe(8);

    // Fallback when cpus is empty
    expect(
      resolveWorkers(undefined, {
        cpus: () => ({ length: 0 }),
      })
    ).toBe(1);
  });
});
