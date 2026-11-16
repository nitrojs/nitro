import { describe, expect, it } from "vitest";
import { shutdownRunner } from "../../src/dev/shutdown.ts";

describe("shutdownRunner", () => {
  it("sends the shutdown timeout so an open socket cannot block close hooks", async () => {
    const messages: unknown[] = [];
    const listeners = new Set<(message: any) => void>();
    const manager = {
      sendMessage(message: unknown) {
        messages.push(message);
      },
      onMessage(listener: (message: any) => void) {
        listeners.add(listener);
      },
      offMessage(listener: (message: any) => void) {
        listeners.delete(listener);
      },
    };

    const pending = shutdownRunner(manager as any);
    try {
      expect(messages).toEqual([{ event: "shutdown", timeout: 5000 }]);
    } finally {
      for (const listener of listeners) {
        listener({ event: "exit" });
      }
      await pending;
    }
  });
});
