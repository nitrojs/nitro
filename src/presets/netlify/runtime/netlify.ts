import "#nitro-internal-pollyfills";
import { useNitroApp } from "nitro/app";
import type { ServerRequest } from "srvx";

const nitroApp = useNitroApp();

const ONE_YEAR_IN_SECONDS = 365 * 24 * 60 * 60;

const handler = async (req: Request): Promise<Response> => {
  const response = await nitroApp.fetch(req);

  const isr = ((req as ServerRequest).context?.routeRules || {})?.isr?.options;
  if (isr) {
    const maxAge = typeof isr === "number" ? isr : ONE_YEAR_IN_SECONDS;
    const revalidateDirective =
      typeof isr === "number"
        ? `stale-while-revalidate=${ONE_YEAR_IN_SECONDS}`
        : "must-revalidate";
    if (!response.headers.has("Cache-Control")) {
      response.headers.set(
        "Cache-Control",
        "public, max-age=0, must-revalidate"
      );
    }
    response.headers.set(
      "Netlify-CDN-Cache-Control",
      `public, max-age=${maxAge}, ${revalidateDirective}, durable`
    );
  }

  return response;
};

export default handler;
