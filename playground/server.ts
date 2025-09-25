export default {
  async fetch(req: Request) {
    const url = new URL(req.url);
    if (url.pathname === "/") {
      return new Response(
        /* html */ `
        <h1>Nitro Playground!</h1>
        <ul><li><a href="/test">/test</a></li></ul>
      `,
        { headers: { "Content-Type": "text/html" } }
      );
    }
  },
};
