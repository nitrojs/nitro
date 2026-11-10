import type { ArgsDef } from "citty";
import { readFile } from "node:fs/promises";
import { buffer } from "node:stream/consumers";
import { parseArgs } from "node:util";

export const fetchArgs = {
  url: {
    type: "positional",
    required: false,
    description: "URL or path to fetch (default: `/`)",
  },
  dir: { type: "string", description: "project root directory" },
  envName: {
    type: "string",
    description:
      "The environment name used to apply `$env.<name>` config overrides and exposed as `import.meta.envName` (default: `production`). A running dev server is only used if it has the same one (`development` by default).",
  },
  dev: {
    type: "boolean",
    default: true,
    description:
      "send the request to the running `nitro dev` server of the project, if any (`--no-dev` starts a server)",
  },
  request: {
    type: "string",
    alias: "X",
    description: "request method (default: `GET`, or `POST` with a body)",
  },
  header: {
    type: "string",
    alias: "H",
    description: "request header (`Name: value`, `Name:` removes it), can be repeated",
  },
  data: {
    type: "string",
    alias: "d",
    description: "request body (`@file` reads a file, `@-` stdin), can be repeated",
  },
  "data-raw": { type: "string", description: "like `--data`, without `@` handling" },
  "data-binary": { type: "string", description: "like `--data`, keeping newlines of files" },
  json: {
    type: "string",
    description: "JSON request body (like `--data-binary`), setting `content-type` and `accept`",
  },
  include: {
    type: "boolean",
    alias: "i",
    description: "include the response status and headers in the output",
  },
  head: { type: "boolean", alias: "I", description: "send a `HEAD` request, print the headers" },
  output: { type: "string", alias: "o", description: "write the body to a file instead of stdout" },
  silent: { type: "boolean", alias: "s", description: "hide the Nitro logs and the error message" },
  verbose: {
    type: "boolean",
    alias: "v",
    description: "print the request and response headers and the Nitro info logs (to stderr)",
  },
} satisfies ArgsDef;

export interface FetchOptions {
  url: string;
  dir?: string;
  envName?: string;
  dev?: boolean;
  method?: string;
  headers: string[];
  /** Body parts with the option that set them, in order. */
  data: { name: string; value: string }[];
  include?: boolean;
  head?: boolean;
  output?: string;
  silent?: boolean;
  verbose?: boolean;
}

const dataOptions = new Set(["data", "data-raw", "data-binary", "json"]);

/** Parse curl-like arguments (repeatable options are kept in order, unknown ones throw). */
export function parseFetchArgs(rawArgs: string[]): FetchOptions {
  const options: Record<
    string,
    { type: "string" | "boolean"; short?: string; multiple?: boolean }
  > = {};
  for (const [name, arg] of Object.entries(fetchArgs)) {
    if (arg.type !== "positional") {
      const multiple = name === "header" || dataOptions.has(name);
      options[name] = { type: arg.type, multiple, ...("alias" in arg && { short: arg.alias }) };
    }
  }
  const { values, positionals, tokens } = parseArgs({
    args: rawArgs,
    options,
    allowPositionals: true,
    allowNegative: true,
    tokens: true,
  });
  if (positionals.length > 1) {
    throw new Error(`Expected a single URL, got: ${positionals.join(" ")}`);
  }
  const data: FetchOptions["data"] = [];
  for (const token of tokens) {
    if (token.kind === "option" && dataOptions.has(token.name)) {
      data.push({ name: token.name, value: token.value ?? "" });
    }
  }
  return {
    url: positionals[0] || "/",
    dir: values.dir as string | undefined,
    envName: values.envName as string | undefined,
    dev: values.dev as boolean | undefined,
    method: values.request as string | undefined,
    headers: (values.header as string[] | undefined) || [],
    data,
    include: values.include as boolean | undefined,
    head: values.head as boolean | undefined,
    output: values.output as string | undefined,
    silent: values.silent as boolean | undefined,
    verbose: values.verbose as boolean | undefined,
  };
}

/** Create the request (paths are resolved against `http://localhost`). */
export async function createFetchRequest(opts: FetchOptions): Promise<Request> {
  if (/^[^/?#]+:\d+(?:[/?#]|$)/.test(opts.url)) {
    throw new Error(
      `Invalid URL: \`${opts.url}\` (use a path like \`/api\`, or a full URL like \`http://${opts.url}\`)`
    );
  }
  const url = /^https?:\/\//i.test(opts.url)
    ? new URL(opts.url)
    : new URL(opts.url.replace(/^\/*/, "/"), "http://localhost");

  // The worker runner sends the request over HTTP to its own address
  const headers = new Headers({ host: url.host });
  const isJSON = opts.data.some((part) => part.name === "json");
  if (isJSON && opts.data.some((part) => part.name !== "json")) {
    throw new Error("`--json` can not be combined with the other `--data` options");
  }
  if (opts.data.length > 0) {
    headers.set("content-type", isJSON ? "application/json" : "application/x-www-form-urlencoded");
  }
  if (isJSON) {
    headers.set("accept", "application/json");
  }
  const userHeaders = new Set<string>();
  for (const header of opts.headers) {
    const index = header.indexOf(":");
    if (index <= 0) {
      throw new Error(`Invalid header: \`${header}\` (expected \`Name: value\`)`);
    }
    const name = header.slice(0, index).trim().toLowerCase();
    const value = header.slice(index + 1).trim();
    if (!value) {
      headers.delete(name);
    } else if (userHeaders.has(name)) {
      headers.append(name, value);
    } else {
      headers.set(name, value);
    }
    userHeaders.add(name);
  }

  let body: Uint8Array<ArrayBuffer> | undefined;
  if (opts.data.length > 0) {
    const parts = await Promise.all(opts.data.map((part) => readData(part)));
    const separator = Buffer.from(isJSON ? "" : "&");
    body = new Uint8Array(
      Buffer.concat(parts.flatMap((part, i) => (i === 0 ? [part] : [separator, part])))
    );
  }

  const method = (
    opts.method || (opts.head ? "HEAD" : body === undefined ? "GET" : "POST")
  ).toUpperCase();
  return new Request(url, { method, headers, body });
}

async function readData({ name, value }: FetchOptions["data"][number]): Promise<Buffer> {
  if (name === "data-raw" || !value.startsWith("@")) {
    return Buffer.from(value);
  }
  const path = value.slice(1);
  const contents = path === "-" ? await buffer(process.stdin) : await readFile(path);
  // Like curl, `--data` strips the newlines of files
  return name === "data" ? Buffer.from(contents.toString().replace(/[\r\n]/g, "")) : contents;
}
