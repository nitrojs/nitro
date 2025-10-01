export default () =>
  new Response("<h1>Hello World</h1>", {
    headers: { "Content-Type": "text/html" },
  });
