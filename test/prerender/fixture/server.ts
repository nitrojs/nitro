export default {
  fetch(req: Request) {
    const { pathname } = new URL(req.url);
    // `/shell/*` renders the same output for every path, like the shell of an SPA
    const body = pathname.startsWith("/shell") ? "shell" : `rendered ${pathname}`;
    return new Response(`<!DOCTYPE html><html><body>${body}</body></html>`, {
      headers: { "content-type": "text/html" },
    });
  },
};
