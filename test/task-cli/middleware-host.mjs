import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { NodeRequest } from "srvx/node";

const { middleware, handleUpgrade } = await import(pathToFileURL(process.argv[2]).href);
const app = globalThis.__taskCliFixtureApp;
await app.ready;
const server = createServer(middleware);
server.on("upgrade", (req, socket, head) => {
  handleUpgrade(req, socket, head, new NodeRequest({ req, upgrade: { socket, head } }));
});
await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});
console.log(`http://127.0.0.1:${server.address().port}`);
process.once("SIGTERM", async () => {
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  );
  await app.hooks.callHook("close");
});
