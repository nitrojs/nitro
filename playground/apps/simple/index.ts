export default {
  fetch(request: Request): Response | Promise<Response> {
    return new Response(`Response from Simple App! (${request.url})`);
  },
};
