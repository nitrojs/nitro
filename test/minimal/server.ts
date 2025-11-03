export default {
  fetch(request: Request) {
    // return new Response("ok");
    return new Response("404 Not Found", { status: 404 });
  },
};
