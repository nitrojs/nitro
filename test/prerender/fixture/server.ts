export default {
  fetch(req: Request) {
    const { pathname } = new URL(req.url);
    return new Response(`<!DOCTYPE html><html><body>rendered ${pathname}</body></html>`, {
      headers: { "content-type": "text/html" },
    });
  },
};
