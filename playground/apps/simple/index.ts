export default {
  async fetch(req: Request): Promise<Response | Promise<Response>> {
    return new Response(`Response from Simple Service (${req.url})`);
  },
};
