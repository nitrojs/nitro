export default {
  async fetch(req: Request): Promise<Response> {
    // const url = new URL(req.url);
    return new Response(`Hello world! (${req.url})`);
  },
};
