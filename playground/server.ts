export default {
  fetch(req: Request) {
    return new Response("Hello from Nitro playground! " + Object.keys(globalThis).join(", "), {
      headers: {
        "Content-Type": "text/plain",
      },
    });
  },
};
