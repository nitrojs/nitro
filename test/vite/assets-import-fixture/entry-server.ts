import { fetchViteEnv } from "nitro/vite/runtime";
import "./server.css";
import clientAssets from "./entry-client.ts?assets=client";
import serverAssets from "./entry-server.ts?assets=ssr";

export default {
  async fetch(req: Request) {
    const { pathname } = new URL(req.url);
    if (pathname === "/api") {
      return fetchViteEnv("api", req);
    }
    if (import.meta.env.MODE === "development" && pathname === "/lazy") {
      // Not loaded by the ssr environment yet
      return Response.json((await import("./lazy.ts?assets=ssr")).default);
    }
    // Collected before the module itself is loaded
    const { default: pageAssets } = await import("./page.ts?assets");
    const { page } = await import("./page.ts");
    return Response.json({
      page,
      assets: {
        client: clientAssets,
        server: serverAssets,
        page: pageAssets,
        merged: clientAssets.merge(serverAssets, pageAssets),
      },
    });
  },
};
