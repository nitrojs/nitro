defineRouteMeta({
  openAPI: {
    tags: ["test"],
    description: "Test route description",
    parameters: [{ in: "query", name: "test", required: true }],
    responses: {
      200: {
        description: "OK ",
        content: {
          "application/json": { schema: { $ref: "#/components/schemas/Test" } },
        },
      },
    },
    components: {
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
});

export default defineEventHandler(() => {
  return {
    status: "OK",
  };
});
