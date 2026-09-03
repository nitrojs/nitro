import { defineRouteMeta } from "nitro";

defineRouteMeta({
  openAPI: {
    tags: ["test"],
    description: "Vite builder route description",
    parameters: [{ in: "query", name: "vite-test", required: true }],
    responses: {
      200: { description: "result" },
    },
  },
});

export default () => ({ status: "OK" });
