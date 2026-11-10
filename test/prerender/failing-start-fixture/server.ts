await Promise.reject(new Error("prerender entry failed to start"));

export default {
  fetch() {
    return new Response("unreachable");
  },
};
