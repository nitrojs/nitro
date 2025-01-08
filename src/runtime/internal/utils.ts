import type { Readable } from "node:stream";
import type { H3Event } from "h3";
import { getRequestHeader, splitCookiesString } from "h3";
import { useNitroApp } from "./app";

const METHOD_WITH_BODY_RE = /post|put|patch/i;
const TEXT_MIME_RE = /application\/text|text\/html/;
const JSON_MIME_RE = /application\/json/;

export function requestHasBody(request: globalThis.Request): boolean {
  return METHOD_WITH_BODY_RE.test(request.method);
}

export async function useRequestBody(
  request: globalThis.Request
): Promise<any> {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("form")) {
    const formData = await request.formData();
    const body = Object.create(null);
    for (const entry of formData.entries()) {
      body[entry[0]] = entry[1];
    }
    return body;
  }
  if (JSON_MIME_RE.test(contentType)) {
    return request.json();
  }
  if (TEXT_MIME_RE.test(contentType)) {
    return request.text();
  }
  const blob = await request.blob();
  return URL.createObjectURL(blob);
}

function _captureError(error: Error, type: string) {
  console.error(`[nitro] [${type}]`, error);
  useNitroApp().captureError(error, { tags: [type] });
}

export function trapUnhandledNodeErrors() {
  process.on("unhandledRejection", (error: Error) =>
    _captureError(error, "unhandledRejection")
  );
  process.on("uncaughtException", (error: Error) =>
    _captureError(error, "uncaughtException")
  );
}

export function joinHeaders(value: number | string | string[]) {
  return Array.isArray(value) ? value.join(", ") : String(value);
}

export function normalizeFetchResponse(response: Response) {
  if (!response.headers.has("set-cookie")) {
    return response;
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: normalizeCookieHeaders(response.headers),
  });
}

export function normalizeCookieHeader(header: number | string | string[] = "") {
  return splitCookiesString(joinHeaders(header));
}

export function normalizeCookieHeaders(headers: Headers) {
  const outgoingHeaders = new Headers();
  for (const [name, header] of headers) {
    if (name === "set-cookie") {
      for (const cookie of normalizeCookieHeader(header)) {
        outgoingHeaders.append("set-cookie", cookie);
      }
    } else {
      outgoingHeaders.set(name, joinHeaders(header));
    }
  }
  return outgoingHeaders;
}

export function toBuffer(data: ReadableStream | Readable | Uint8Array) {
  if ("pipeTo" in data && typeof data.pipeTo === "function") {
    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      data
        .pipeTo(
          new WritableStream({
            write(chunk) {
              chunks.push(chunk);
            },
            close() {
              resolve(Buffer.concat(chunks));
            },
            abort(reason) {
              reject(reason);
            },
          })
        )
        .catch(reject);
    });
  }
  if ("pipe" in data && typeof data.pipe === "function") {
    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      data
        .on("data", (chunk: any) => {
          chunks.push(chunk);
        })
        .on("end", () => {
          resolve(Buffer.concat(chunks));
        })
        .on("error", reject);
    });
  }
  // @ts-ignore
  return Buffer.from(data as unknown as Uint16Array);
}
