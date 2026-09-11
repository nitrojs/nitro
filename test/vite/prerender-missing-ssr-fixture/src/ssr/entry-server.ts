// SSR entry deliberately placed *outside* the auto-detected directories
// (`<root|app|src>/entry-server.*`) to reproduce #4591.
export default {
  fetch(_req: Request) {
    return new Response("<!doctype html><h1>ssr</h1>", {
      headers: { "content-type": "text/html" },
    });
  },
};
