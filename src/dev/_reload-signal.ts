import type { H3Event } from "h3";

export const DEV_RELOAD_ROUTE = "/_nitro/dev/reload";

const WAIT_TIMEOUT = 25_000;

/**
 * Counts the server reloads, so that open dev error pages can wait for the next one with
 * {@link DEV_RELOAD_ROUTE} instead of a browser connection of the builder (Vite HMR).
 */
export class DevReloadSignal {
  /** Changes when the dev server restarts, which starts the count again. */
  readonly id: string = Math.random().toString(36).slice(2);
  generation: number = 0;
  closed: boolean = false;

  #waiters = new Set<() => void>();

  bump() {
    this.generation++;
    this.#release();
  }

  close() {
    this.closed = true;
    this.#release();
  }

  /** Answers `{ id, v }` once the server is past generation `v` of instance `id`, else 204 after a timeout. */
  async handle(event: H3Event): Promise<Response | { id: string; v: number }> {
    const params = event.url.searchParams;
    if (
      !this.closed &&
      params.get("id") === this.id &&
      params.get("v") === String(this.generation)
    ) {
      await this.#wait(event.req.signal);
    }
    if (this.closed) {
      return new Response(null, { status: 503, headers: { "cache-control": "no-store" } });
    }
    if (params.get("id") === this.id && params.get("v") === String(this.generation)) {
      return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
    }
    event.res.headers.set("cache-control", "no-store");
    return { id: this.id, v: this.generation };
  }

  #wait(abort?: AbortSignal) {
    return new Promise<void>((resolve) => {
      const done = () => {
        clearTimeout(timer);
        abort?.removeEventListener("abort", done);
        this.#waiters.delete(done);
        resolve();
      };
      const timer = setTimeout(done, WAIT_TIMEOUT);
      (timer as { unref?: () => void }).unref?.();
      abort?.addEventListener("abort", done);
      this.#waiters.add(done);
    });
  }

  #release() {
    for (const done of [...this.#waiters]) {
      done();
    }
  }
}
