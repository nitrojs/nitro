import { expect } from "vitest";
import type { BuiltFixture } from "./_build.ts";
import { startCLI, startMain, stages } from "./_run.ts";

export async function checkMainAndSidecar(fixture: BuiltFixture) {
  const sidecar = fixture.probeGraphs.filter((graph) =>
    graph.inputs.some((input) => /\/runtime\/task-cli(?:\.[cm]?[jt]s)?$/.test(input))
  );
  expect(sidecar.length).toBeGreaterThan(0);
  expect(sidecar.every((graph) => graph.constructors > 0)).toBe(true);
  expect(
    fixture.probeGraphs.some((graph) => !sidecar.includes(graph) && graph.constructors > 0)
  ).toBe(true);
  const main = await startMain(fixture, { probes: true });
  try {
    const url = await main.waitForListening();
    if (fixture.info.preset === "node-cluster") {
      await main.waitForProcessCount("plugin:ready", 2);
    }
    const response = await fetch(url + "/probe");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ready: true });
    await websocketMessage(url);
    expect(main.signal("SIGTERM")).toBe(true);
    const result = await main.finished;
    expect(result.code).toBe(0);
    expect(result.signal).toBeNull();
    expect(stages(result).filter((stage) => stage === "framework:listen").length).toBeGreaterThan(
      0
    );
    expect(stages(result).filter((stage) => stage === "framework:cron").length).toBeGreaterThan(0);
    expect(stages(result).filter((stage) => stage === "framework:fork")).toHaveLength(
      fixture.info.preset === "node-cluster" ? 2 : 0
    );
    expect(stages(result).filter((stage) => stage === "plugin:close")).toHaveLength(
      fixture.info.preset === "node-cluster" ? 2 : 1
    );
  } finally {
    main.signal("SIGTERM");
    await main.finished;
  }
  for (const args of [["--help"], ["list"], ["run", "echo:payload"]]) {
    const child = await startCLI(fixture, args, { probes: true });
    const result = await child.finished;
    expect(result.code).toBe(0);
    expect(result.signal).toBeNull();
    expect(stages(result)).toContain("probe:installed");
    expect(stages(result).filter((stage) => stage.startsWith("framework:"))).toEqual([]);
    if (args[0] === "run") {
      expect(stages(result)).not.toContain("handler:unselected");
      expect(stages(result).filter((stage) => stage === "plugin:close")).toHaveLength(1);
    } else {
      expect(
        stages(result).filter(
          (stage) => stage.startsWith("plugin:") || stage.startsWith("handler:")
        )
      ).toEqual([]);
    }
  }
}

function websocketMessage(url: string) {
  return new Promise<void>((resolve, reject) => {
    const socket = new WebSocket(url.replace("http:", "ws:") + "/ws");
    const timeout = setTimeout(() => {
      socket.close();
      reject(new Error("WebSocket fixture timed out"));
    }, 5000);
    let received = false;
    socket.addEventListener("message", (event) => {
      try {
        expect(event.data).toBe("task-cli-main-websocket");
        received = true;
        socket.close();
      } catch (error) {
        clearTimeout(timeout);
        socket.close();
        reject(error);
      }
    });
    socket.addEventListener("error", () => {
      clearTimeout(timeout);
      socket.close();
      reject(new Error("WebSocket fixture failed"));
    });
    socket.addEventListener("close", () => {
      clearTimeout(timeout);
      if (received) resolve();
      else reject(new Error("WebSocket closed before a message"));
    });
  });
}
