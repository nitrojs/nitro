export default {
  async fetch(req: Request) {
    console.log(`[${req.method}] ${req.url}`);
    const url = new URL(req.url);
    if (url.pathname === "/server") {
      return new Response("Response from server.ts");
    }
    if (url.pathname === "/") {
      return fetch(req, { viteEnv: "ssr" } as any);
    }
  },
};
