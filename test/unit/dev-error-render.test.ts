import { readFileSync } from "node:fs";
import { stripVTControlCharacters } from "node:util";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { renderErrorANSI, renderErrorHTML } from "../../src/runtime/internal/error/_utils.ts";

const thisFile = fileURLToPath(import.meta.url);
const markerLine = readFileSync(thisFile, "utf8").split("\n").indexOf("// code-frame-marker") + 1;

function createError(message: string, opts?: ErrorOptions & { file?: string }): Error {
  const error = new Error(message, opts);
  error.stack = [
    `Error: ${message}`,
    `    at handler (${opts?.file || "/app/server/routes/index.ts"}:${markerLine}:4)`,
    "    at Object.<anonymous> (/app/node_modules/h3/dist/h3.mjs:5:6)",
    "    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)",
  ].join("\n");
  return error;
}

describe("dev error: HTML", () => {
  it("escapes all interpolated values", async () => {
    const error = Object.assign(createError(`<script>alert("msg")</script>`), {
      name: "<img onerror=x>",
      hint: "<b>hint</b> & 'quoted'",
    });
    const html = await renderErrorHTML(error, {
      status: 500,
      statusText: "<status>",
      request: {
        method: "GET",
        url: "http://localhost/?q=<x>",
        headers: { "x-test": `"><script>alert(1)</script>`, cookie: "session=<abc>; theme=dark" },
      },
    });
    expect(html).not.toMatch(/<script>alert|<img|<b>hint|<status>|<x>|<abc>/);
    expect(html.match(/<script>/g)).toHaveLength(1);
    expect(html).toContain("&#60;script&#62;alert(&#34;msg&#34;)&#60;/script&#62;");
    expect(html).toContain(
      `<p class="hint">&#60;b&#62;hint&#60;/b&#62; &#38; &#39;quoted&#39;</p>`
    );
    expect(html).toContain(
      "<td>x-test</td><td>&#34;&#62;&#60;script&#62;alert(1)&#60;/script&#62;</td>"
    );
    expect(html).toContain("<h3>Cookies</h3>");
    expect(html).toContain("<td>session</td><td>&#60;abc&#62;</td>");
    expect(html).not.toContain("<td>cookie</td>");
  });

  it("renders frames with a code frame for the first app frame", async () => {
    const html = await renderErrorHTML(createError("boom", { file: thisFile }), { status: 500 });
    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html).toContain("<title>Error: boom (500)</title>");
    expect(html).toContain(
      '<p class="meta"><span class="pill">500</span><span class="reason">Internal Server Error</span><span class="name">Error</span></p>'
    );
    expect(html).toContain("<h1>boom</h1>");
    expect(html).toContain('<li class="frame app"><details open><summary>');
    expect(html).not.toContain("<a ");
    expect(html).toContain(
      `data-text="./test/unit/dev-error-render.test.ts:${markerLine}:4" title="Copy path">./test/unit/dev-error-render.test.ts:${markerLine}:4<span class="cp">`
    );
    expect(html).toContain(`<div class="hl"><span class="ln">${markerLine}</span>`);
    expect(html).toContain('<li class="frame module"><div>');
    expect(html).toContain('<li class="frame native"><div>');
  });

  it("renders the first message line as headline", async () => {
    const error = Object.assign(createError("first line\n  detail"), { name: "HTTPError" });
    const html = await renderErrorHTML(error, { status: 503, statusText: "Custom" });
    expect(html).toContain("<title>HTTPError: first line (503)</title>");
    expect(html).toContain(
      '<span class="pill">503</span><span class="reason">Custom</span><span class="name">HTTPError</span>'
    );
    expect(html).toContain('<h1>first line</h1><pre class="msg">  detail</pre>');
  });

  it("renders a copy button with the plain text error", async () => {
    const html = await renderErrorHTML(createError("boom", { file: thisFile }), {
      request: { method: "POST", url: "http://localhost/api", headers: {} },
    });
    expect(html).toContain(
      `<main><section class="error"><header class="head"><p class="meta"><span class="name">Error</span></p><div class="actions"><button type="button" class="copy" data-text=`
    );
    const text = html.match(
      /<button type="button" class="copy" data-text="([^"]*)" title="Copy error"/
    )?.[1];
    expect(text).toBeDefined();
    expect(text).not.toContain("\u001B[");
    expect(text).toMatch(/^POST http:\/\/localhost\/api\n\nError: boom\n/);
    expect(text).toContain(`  at handler (./test/unit/dev-error-render.test.ts:${markerLine}:4)`);
    expect(html).toContain("navigator.clipboard.writeText");
  });

  it("renders the cause as highlighted JSON with a copy button", async () => {
    const inner = Object.assign(createError("msg-inner"), { code: "E_INNER" });
    const error = createError("msg-outer", { cause: { id: 1n, inner } });
    (inner as any).cause = error;
    const html = await renderErrorHTML(error);
    const cause = html.slice(html.indexOf("<h2>Caused by</h2>"));
    expect(cause).toMatch(/^<h2>Caused by<\/h2><div class="block"><button[^>]+class="copy"/);
    expect(cause).toContain('<div class="code json">');
    expect(cause).toContain('<span class="str">&#34;E_INNER&#34;</span>');
    const json = JSON.parse(
      cause
        .match(/data-text="([^"]*)"/)![1]!
        .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(Number(c)))
    );
    expect(json).toMatchObject({
      id: "1n",
      inner: {
        name: "Error",
        message: "msg-inner",
        code: "E_INNER",
        stack: [
          `at handler (/app/server/routes/index.ts:${markerLine}:4)`,
          "at Object.<anonymous> (h3/dist/h3.mjs:5:6)",
          "at process.processTicksAndRejections (node:internal/process/task_queues:105:5)",
        ],
        cause: { message: "msg-outer", cause: "[Circular]" },
      },
    });
  });

  it("renders aggregate errors", async () => {
    const error = new AggregateError([createError("msg-first"), "msg-second"], "msg-agg");
    error.stack = createError("msg-agg").stack;
    const html = (await renderErrorHTML(error)).replace(/ data-text="[^"]*"/g, "");
    const positions = ["msg-agg", "<h2>Errors</h2>", "msg-first", "msg-second"].map((text) =>
      html.indexOf(text, html.indexOf('<section class="error">'))
    );
    expect(positions.every((p) => p > 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("shortens node_modules paths", async () => {
    const error = createError("boom");
    error.stack +=
      "\n    at x (/app/node_modules/.pnpm/h3@2.0.0/node_modules/h3/dist/cache.mjs:1:2)";
    const html = await renderErrorHTML(error);
    expect(html).toContain(
      'data-text="/app/node_modules/.pnpm/h3@2.0.0/node_modules/h3/dist/cache.mjs:1:2" title="Copy path">h3/dist/cache.mjs:1:2<span class="cp">'
    );
  });

  it("renders a copy path button per frame", async () => {
    const error = createError("boom", { file: thisFile });
    error.stack += `\n    at x (${process.cwd()}/node_modules/.pnpm/h3@2.0.0/node_modules/h3/dist/cache.mjs:1:2)`;
    const html = await renderErrorHTML(error);
    const paths = [...html.matchAll(/class="copy-loc"[^>]* data-text="([^"]*)"/g)].map((m) => m[1]);
    expect(paths).toEqual([
      `./test/unit/dev-error-render.test.ts:${markerLine}:4`,
      "/app/node_modules/h3/dist/h3.mjs:5:6",
      "./node_modules/.pnpm/h3@2.0.0/node_modules/h3/dist/cache.mjs:1:2",
    ]);
  });
});

describe("dev error: ANSI", () => {
  it("renders message, code frame, stack and causes", async () => {
    const cause = createError("root cause");
    const error = Object.assign(createError("boom", { cause, file: thisFile }), {
      hint: "try again",
    });
    const output = stripVTControlCharacters(await renderErrorANSI(error));
    const lines = output.split("\n");
    expect(lines[0]).toBe("Error: boom");
    expect(lines[1]).toBe("try again");
    expect(output).toContain(`❯ ${markerLine} │ // code-frame-marker\n`);
    expect(output).toContain(`  at handler (./test/unit/dev-error-render.test.ts:${markerLine}:4)`);
    expect(output).toContain("  at Object.<anonymous> (h3/dist/h3.mjs:5:6)");
    expect(output).toContain(
      "  at process.processTicksAndRejections (node:internal/process/task_queues:105:5)"
    );
    expect(output).toContain("[cause] Error: root cause");
  });

  it("renders async frames", async () => {
    const error = new Error("boom");
    error.stack = [
      "Error: boom",
      "    at async handler (/app/a.mjs:1:2)",
      "    at async /app/b.mjs:3:4",
    ].join("\n");
    const output = stripVTControlCharacters(await renderErrorANSI(error));
    expect(output).toContain("  at async handler (/app/a.mjs:1:2)\n  at async /app/b.mjs:3:4");
  });
});

// code-frame-marker
