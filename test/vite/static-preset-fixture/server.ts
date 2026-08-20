export default {
  fetch(_req: Request) {
    return new Response("<h1>prerendered</h1>", {
      headers: { "content-type": "text/html" },
    });
  },
};
