import { createWriteStream } from "node:fs";
import { STATUS_CODES } from "node:http";
import { Readable, type Writable } from "node:stream";
import { finished, pipeline } from "node:stream/promises";
import { defineCommand } from "citty";
import { LogLevels, consola } from "consola";
import { resolve } from "pathe";
import { startUnbundledServer } from "../../../build/unbundled/serve.ts";
import { fetchDevServer, findDevServer } from "./_dev.ts";
import { type FetchOptions, createFetchRequest, fetchArgs, parseFetchArgs } from "./_request.ts";

export default defineCommand({
  meta: {
    name: "fetch",
    description:
      "Send one request to the server sources, without a build (`builder: false`), and print the response",
  },
  args: fetchArgs,
  async run({ rawArgs }) {
    let opts: FetchOptions;
    let request: Request;
    try {
      opts = parseFetchArgs(rawArgs);
      if (opts.silent) {
        consola.level = LogLevels.silent;
      }
      request = await createFetchRequest(opts);
    } catch (error) {
      consola.error((error as Error).message);
      process.exit(2);
    }

    let exitCode = 0;
    const abort = new AbortController();
    for (const signal of ["SIGINT", "SIGTERM"] as const) {
      // Once, so that a second signal exits right away
      process.once(signal, () => {
        exitCode = signal === "SIGINT" ? 130 : 143;
        abort.abort();
      });
    }

    // Server logs go to stderr, so that stdout only has the response
    const stdout = stdoutWriter();

    const rootDir = resolve(opts.dir || ".");
    const dev =
      opts.dev === false ? undefined : await findDevServer(rootDir, { envName: opts.envName });
    consola.level = opts.silent ? LogLevels.silent : 3;
    if (dev) {
      consola.info(`Using the running dev server at \`${dev.url}\` (pid: ${dev.pid})`);
    }
    consola.level = opts.silent ? LogLevels.silent : opts.verbose ? 3 : 1;

    const server = dev
      ? undefined
      : await startUnbundledServer({
          rootDir,
          envName: opts.envName,
          // Listen (on a random port), so that requests go through the server middleware
          listen: { port: 0, hostname: "127.0.0.1", silent: true },
        });

    let outputError: Error | undefined;
    try {
      abort.signal.throwIfAborted();
      if (opts.verbose) {
        const url = new URL(request.url);
        printHeaders(`${request.method} ${url.pathname}${url.search} HTTP/1.1`, request.headers, {
          prefix: "> ",
        });
      }
      const skipBody = new AbortController();
      const req = new Request(request, {
        signal: AbortSignal.any([abort.signal, skipBody.signal]),
      });
      const res = await (server ? server.runner.fetch(req) : fetchDevServer(dev!, req));
      const statusLine =
        `HTTP/1.1 ${res.status} ${res.statusText || STATUS_CODES[res.status] || ""}`.trimEnd();
      if (opts.verbose) {
        printHeaders(statusLine, res.headers, { prefix: "< " });
      }
      const out = opts.output && opts.output !== "-" ? createWriteStream(opts.output) : stdout;
      out.once("error", (error) => (outputError = error));
      if (opts.include || opts.head) {
        await writeHeaders(out, statusLine, res.headers);
      }
      if (res.body && !opts.head) {
        // A web stream source would not be cancelled on abort
        await pipeline(Readable.fromWeb(res.body), out, { signal: abort.signal });
      } else {
        // Cancelling the body would not end the request in the worker runner
        skipBody.abort();
        out.end();
        await finished(out);
      }
      // Like `curl --fail-with-body`
      if (res.status >= 400) {
        exitCode = 22;
        if (!opts.silent) {
          consola.error(`The requested URL returned error: ${res.status}`);
        }
      }
    } catch (error) {
      if (abort.signal.aborted) {
        // Interrupted
      } else if (outputError) {
        // Like curl, also when stdout is closed early (`nitro fetch | head`)
        exitCode = 23;
        if (!opts.silent && (outputError as NodeJS.ErrnoException).code !== "EPIPE") {
          consola.error(`Failed writing the output: ${outputError.message}`);
        }
      } else {
        exitCode = 1;
        consola.error(error);
      }
    }

    await server?.close();
    await Promise.all(
      [stdout, process.stderr]
        .filter((stream) => stream.writable)
        .map((stream) => new Promise((resolve) => stream.write("", resolve)))
    );
    process.exit(exitCode);
  },
});

/**
 * A writer to the stdout file descriptor, redirecting `process.stdout` writes to stderr.
 *
 * `process.stdout` itself never writes to it, so it does not fail when stdout is closed
 * (that would also stop forwarding the logs of the worker runner).
 */
function stdoutWriter(): Writable {
  process.stdout.write = process.stderr.write.bind(process.stderr);
  return createWriteStream("", { fd: 1, autoClose: false });
}

function printHeaders(firstLine: string, headers: Headers, opts: { prefix: string }) {
  const lines = [firstLine, ...[...headers].map(([name, value]) => `${name}: ${value}`), ""];
  process.stderr.write(lines.map((line) => opts.prefix + line).join("\n") + "\n");
}

function writeHeaders(out: Writable, statusLine: string, headers: Headers): Promise<void> {
  const lines = [statusLine, ...[...headers].map(([name, value]) => `${name}: ${value}`)];
  return new Promise((resolve, reject) =>
    out.write(lines.join("\r\n") + "\r\n\r\n", (error) => (error ? reject(error) : resolve()))
  );
}
