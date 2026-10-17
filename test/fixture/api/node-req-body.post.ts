// Consumes `event.node.req` directly as a Node.js readable stream, the same
// way `fetch(url, { body: event.node.req })` does for raw body pass-through.
export default eventHandler(async (event) => {
  const readableEnded = event.node.req.readableEnded;
  const chunks: Buffer[] = [];
  for await (const chunk of event.node.req) {
    chunks.push(chunk);
  }
  return {
    readableEnded,
    body: Buffer.concat(chunks).toString("utf8"),
  };
});
