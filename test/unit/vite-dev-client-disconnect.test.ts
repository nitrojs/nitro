import { describe, expect, it } from "vitest";
import { isResponseDestroyed } from "../../src/build/vite/dev.ts";

describe("vite dev: isResponseDestroyed", () => {
  it("detects destroyed HTTP/1.1 response", () => {
    expect(isResponseDestroyed({ destroyed: true } as any)).toBe(true);
    expect(isResponseDestroyed({ destroyed: false } as any)).toBe(false);
  });

  it("detects destroyed HTTP/2 Http2ServerResponse where stream.destroyed is true", () => {
    // Node.js Http2ServerResponse has no `destroyed` property (it is undefined),
    // but its underlying ServerHttp2Stream sets `stream.destroyed`.
    expect(isResponseDestroyed({ destroyed: undefined, stream: { destroyed: true } } as any)).toBe(
      true
    );
    expect(isResponseDestroyed({ destroyed: undefined, stream: { destroyed: false } } as any)).toBe(
      false
    );
    expect(isResponseDestroyed({ stream: { destroyed: true } } as any)).toBe(true);
    expect(isResponseDestroyed({ stream: { destroyed: false } } as any)).toBe(false);
  });

  it("returns false when response is not destroyed or has no stream", () => {
    expect(isResponseDestroyed({} as any)).toBe(false);
    expect(isResponseDestroyed({ destroyed: false, stream: undefined } as any)).toBe(false);
  });
});
