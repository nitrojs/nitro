import { describe, expect, it } from "vitest";
import { standardSchemaToJSONSchema } from "../../src/runtime/internal/openapi.ts";

describe("OpenAPI schemas", () => {
  it("preserves recursive local references", () => {
    const node = {
      "~standard": {
        jsonSchema: {
          input: () => ({
            $schema: "https://json-schema.org/draft/2020-12/schema",
            $ref: "#/$defs/Node",
            $defs: {
              Node: {
                type: "object",
                properties: {
                  children: {
                    type: "array",
                    items: { $ref: "#/$defs/Node" },
                  },
                },
              },
            },
          }),
        },
      },
    };

    expect(standardSchemaToJSONSchema(node, { context: "recursive node" })).toEqual({
      type: "object",
      properties: {
        children: {
          type: "array",
          items: { $ref: "#/$defs/Node" },
        },
      },
      $defs: {
        Node: {
          type: "object",
          properties: {
            children: {
              type: "array",
              items: { $ref: "#/$defs/Node" },
            },
          },
        },
      },
    });
  });
});
