export default {
  async fetch(req: Request): Promise<Response> {
    return new Response(`Response from API Service (${req.url})`);
  },
};
