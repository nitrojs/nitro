export default {
  fetch(req: Request) {
    return new Response(`<main>ssr: ${new URL(req.url).pathname}</main>`);
  },
};
