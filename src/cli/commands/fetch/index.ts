import { createWriteStream } from "node:fs";
import { STATUS_CODES } from "node:http";
import { Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { defineCommand } from "citty";
import { consola } from "consola";
import { resolve } from "pathe";
import { startUnbundledServer } from "../../../build/unbundled/serve.ts";
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
      request = await createFetchRequest(opts);
    } catch (error) {
      consola.error((error as Error).message);
      process.exit(2);
    }

    // Server logs go to stderr, so that stdout only has the response
    const stdout = stdoutWriter();
    consola.level = opts.silent ? 0 : opts.verbose ? 3 : 1;

    const server = await startUnbundledServer({
      rootDir: resolve(opts.dir || "."),
      envName: opts.envName,
      // Listen (on a random port), so that requests go through the server middleware
      listen: { port: 0, hostname: "127.0.0.1", silent: true },
    });

    let exitCode = 0;
    for (const signal of ["SIGINT", "SIGTERM"] as const) {
      process.once(signal, async () => {
        await server.close();
        process.exit(signal === "SIGINT" ? 130 : 143);
      });
    }

    try {
      if (opts.verbose) {
        const url = new URL(request.url);
        printHeaders(`${request.method} ${url.pathname}${url.search} HTTP/1.1`, request.headers, {
          prefix: "> ",
        });
      }
      const res = await server.runner.fetch(request);
      const statusLine =
        `HTTP/1.1 ${res.status} ${res.statusText || STATUS_CODES[res.status] || ""}`.trimEnd();
      if (opts.verbose) {
        printHeaders(statusLine, res.headers, { prefix: "< " });
      }
      const out = opts.output && opts.output !== "-" ? createWriteStream(opts.output) : stdout;
      if (opts.include || opts.head) {
        await writeHeaders(out, statusLine, res.headers);
      }
      if (res.body && !opts.head) {
        await pipeline(res.body, out, { end: out !== stdout });
      } else if (out !== stdout) {
        await new Promise((resolve) => out.end(resolve));
      }
      // Like `curl --fail-with-body`
      if (res.status >= 400) {
        exitCode = 22;
        if (!opts.silent) {
          consola.error(`The requested URL returned error: ${res.status}`);
        }
      }
    } catch (error) {
      exitCode = 1;
      consola.error(error);
    }

    await server.close();
    await new Promise((resolve) => stdout.write("", resolve));
    process.exit(exitCode);
  },
});

/** A writer to the actual stdout, redirecting other `process.stdout` writes to stderr. */
function stdoutWriter(): Writable {
  const write = process.stdout.write.bind(process.stdout);
  process.stdout.write = process.stderr.write.bind(process.stderr);
  return new Writable({
    write(chunk, _encoding, callback) {
      write(chunk, callback);
    },
  });
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
