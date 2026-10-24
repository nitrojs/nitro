export default {
  fetch() {
    return new Response(`<!DOCTYPE html><html><body>${import.meta.envName}</body></html>`, {
      headers: { "content-type": "text/html" },
    });
  },
};
