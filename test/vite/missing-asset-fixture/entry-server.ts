export default {
  fetch() {
    return new Response("<h1>renderer</h1>", { headers: { "content-type": "text/html" } });
  },
};
