import { defineRouteMeta } from "nitro";

defineRouteMeta({
  openAPI: {
    tags: ["test"],
    description: "Test route description",
    parameters: [
      { in: "query", name: "test", required: true },
      {
        in: "query",
        name: "val",
        schema: { type: "integer", enum: [0, 1] },
      },
    ],
    responses: {
      200: {
        description: "result",
        content: {
          "application/json": { schema: { $ref: "#/components/schemas/Test" } },
        },
      },
    },
    $global: {
      components: {
        schemas: {
          Test: {
            type: "object",
            properties: {
              status: {
                type: "string",
                enum: ["OK", "ERROR"],
              },
            },
          },
        },
      },
    },
  },
});

export default () => {
  return {
    status: "OK",
  };
};
