// A cold import slower than the ~3 s env-runner gives `fetch()` to find the worker address
await new Promise((resolve) => setTimeout(resolve, 4000));

export default {
  fetch(req: Request) {
    const { pathname } = new URL(req.url);
    return new Response(`<!DOCTYPE html><html><body>rendered ${pathname}</body></html>`, {
      headers: { "content-type": "text/html" },
    });
  },
};
