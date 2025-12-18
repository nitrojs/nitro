import "#nitro-internal-polyfills";
import { useNitroApp } from "nitro/app";
import type { IncomingMessage } from "node:http";
import { normalizeHeaders } from "./_utils.ts";

const nitroApp = useNitroApp();

interface EdgeOneRequest extends IncomingMessage {
  url: string;
  method: string;
  headers: Record<string, string | string[] | undefined>;
}

// EdgeOne bootstrap expects: async (req, context) => Response
export default async function handle(req: EdgeOneRequest, context: unknown) {
  // Build full URL from Node.js request headers
  const host = req.headers['eo-pages-host'] || req.headers['host'] || 'localhost';
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const url = `${protocol}://${host}${req.url}`;

  // Create Web Request from Node.js request
  const request = new Request(url, {
    method: req.method || 'GET',
    headers: normalizeHeaders(req.headers),
  });

  return nitroApp.fetch(request);
}


