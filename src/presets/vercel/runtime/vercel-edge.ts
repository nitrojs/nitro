import "#nitro-internal-pollyfills";
import { useNitroApp } from "nitro/runtime";

const nitroApp = useNitroApp();

export default async function handleEvent(request: Request, event: any) {
  const url = new URL(request.url);

  let body;
  if (request.body) {
    body = await request.arrayBuffer();
  }

  return nitroApp.localFetch(url.pathname + url.search, {
    host: url.hostname,
    protocol: url.protocol,
    headers: request.headers,
    method: request.method,
    body,
    context: {
      vercel: {
        event,
      },
    },
  });
}
