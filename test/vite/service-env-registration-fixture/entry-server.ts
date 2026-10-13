export default {
  fetch() {
    return new Response("<h1>Hello from SSR</h1>", {
      headers: { "content-type": "text/html" },
    });
  },
};
