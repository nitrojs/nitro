export default {
  async fetch(req: Request): Promise<Response | void> {
    const url = new URL(req.url);
    console.log(`[${req.method}] ${req.url}`);
    switch (url.pathname) {
      case "/": {
        return fetch(req, { viteEnv: "ssr" } as any);
      }
      case "/server": {
        return new Response("Response from server.ts");
      }
    }
    console.log("fallback...");
  },
};
