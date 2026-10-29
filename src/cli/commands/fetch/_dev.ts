import { connect } from "node:net";
import { proxyFetch } from "httpxy";
import { getDevBuildInfo } from "../../../build/info.ts";

export interface RunningDevServer {
  pid: number;
  url: string;
}

/** The `nitro dev` server of the project, if it is running and accepts connections. */
export async function findDevServer(rootDir: string): Promise<RunningDevServer | undefined> {
  const dev = (await getDevBuildInfo(rootDir))?.dev;
  if (!dev?.url || !(await isListening(new URL(dev.url)))) {
    return;
  }
  return { pid: dev.pid, url: dev.url };
}

/** Send the request to the dev server, keeping the host of the request URL. */
export function fetchDevServer(dev: RunningDevServer, request: Request): Promise<Response> {
  const url = new URL(dev.url);
  return proxyFetch(url.protocol === "https:" ? url.origin : addressOf(url), request);
}

function addressOf(url: URL) {
  const host = url.hostname.replace(/^\[(.*)\]$/, "$1");
  return {
    // Listening on all addresses (not connectable on Windows)
    host: host === "::" || host === "0.0.0.0" ? "localhost" : host,
    port: Number(url.port) || (url.protocol === "https:" ? 443 : 80),
  };
}

/** Whether a server accepts connections on the URL (the dev info can outlive it). */
function isListening(url: URL): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect(addressOf(url));
    socket.setTimeout(1000);
    const done = (listening: boolean) => {
      socket.destroy();
      resolve(listening);
    };
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
    socket.once("timeout", () => done(false));
  });
}
