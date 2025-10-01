export default {
  async fetch(req: Request): Promise<Response | void> {
    console.log(`[${req.method}] ${req.url}`);
    const url = new URL(req.url);
    if (url.pathname === "/") {
      return new Response("Response from server.ts");
    }
  },
};
