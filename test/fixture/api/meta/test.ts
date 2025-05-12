defineRouteMeta({
  openAPI: {
    tags: ["test", getTag()],
    description: "Test route description",
    parameters: [{ in: "query", name: "test", required: true }],
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

function getTag() {
  return oneMoreDepth();
}

function oneMoreDepth() {
  return "test2";
}

export default defineEventHandler(() => {
  return {
    status: "OK",
  };
});
