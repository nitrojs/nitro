import "#nitro-internal-pollyfills";
import { useNitroApp } from "nitropack/runtime";
import {
  getRouteRulesForPath,
  joinHeaders,
  normalizeCookieHeader,
} from "nitropack/runtime/internal";

const nitroApp = useNitroApp();

const handler = async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const relativeUrl = `${url.pathname}${url.search}`;
  const r = await nitroApp.localCall({
    url: relativeUrl,
    headers: req.headers,
    method: req.method,
    body: req.body,
  });

  const headers = normalizeResponseHeaders({
    ...getCacheHeaders(url.pathname),
    ...r.headers,
  });

  return new Response(r.body, {
    status: r.status,
    headers,
  });
};

export default handler;

// --- internal utils ---

const ONE_YEAR_IN_SECONDS = 365 * 24 * 60 * 60;

type NitroResponseHeaders = Awaited<
  ReturnType<(typeof nitroApp)["localCall"]>
>["headers"];

function normalizeResponseHeaders(headers: NitroResponseHeaders): Headers {
  const outgoingHeaders = new Headers();
  for (const [name, header] of Object.entries(headers)) {
    if (name === "set-cookie") {
      for (const cookie of normalizeCookieHeader(header)) {
        outgoingHeaders.append("set-cookie", cookie);
      }
    } else if (header !== undefined) {
      outgoingHeaders.set(name, joinHeaders(header));
    }
  }
  return outgoingHeaders;
}

function getCacheHeaders(url: string): Record<string, string> {
  const { isr } = getRouteRulesForPath(url);
  if (isr) {
    const maxAge = typeof isr === "number" ? isr : ONE_YEAR_IN_SECONDS;
    const revalidateDirective =
      typeof isr === "number"
        ? `stale-while-revalidate=${ONE_YEAR_IN_SECONDS}`
        : "must-revalidate";
    return {
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Netlify-CDN-Cache-Control": `public, max-age=${maxAge}, ${revalidateDirective}, durable`,
    };
  }
  return {};
}
