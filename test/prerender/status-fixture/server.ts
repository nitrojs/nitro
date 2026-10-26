export default {
  fetch(req: Request) {
    const { pathname } = new URL(req.url);
    // `/status/<code>` responds with that status code
    const status = Number(pathname.match(/^\/status\/(\d{3})$/)?.[1] || 200);
    return new Response(`<!DOCTYPE html><html><body>${status}</body></html>`, {
      status,
      headers: { "content-type": "text/html" },
    });
  },
};
