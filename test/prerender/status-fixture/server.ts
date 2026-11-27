export default {
  fetch(req: Request) {
    const { pathname } = new URL(req.url);
    if (pathname === "/stream-error") {
      return new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode("<!DOCTYPE html><html>"));
            controller.error(new Error("stream boom"));
          },
        }),
        {
          status: 200,
          headers: { "content-type": "text/html" },
        }
      );
    }
    // `/status/<code>` responds with that status code
    const status = Number(pathname.match(/^\/status\/(\d{3})$/)?.[1] || 200);
    return new Response(`<!DOCTYPE html><html><body>${status}</body></html>`, {
      status,
      headers: { "content-type": "text/html" },
    });
  },
};
