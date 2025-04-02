export default eventHandler(
  () =>
    new Response("Hey API", {
      status: 200,
      headers: {
        "Content-Type": "text/html",
      },
    })
);
