export default {
  async fetch(req: Request) {
    const url = new URL(req.url);
    if (url.pathname === "/") {
      return new Response("server entry works!");
    }
  },
};
