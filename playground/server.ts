export default {
  fetch(req: Request) {
    return new Response("Hello from Nitro playground! <a href='/test.txt'>test.txt</a>", {
      headers: { "Content-Type": "text/html" },
    });
  },
};
