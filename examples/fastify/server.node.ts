import Fastify from "fastify";

const app = Fastify();

app.get("/", () => "Hello, Fastify with Nitro!");

await app.ready();

export default app.routing;
