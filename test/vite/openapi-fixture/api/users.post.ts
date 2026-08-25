import { defineRouteMeta } from "nitro";
import { defineValidatedHandler } from "nitro/h3";
import { z } from "zod";

interface UserResponse {
  id: string;
  name: string;
  active?: boolean;
  role: "admin" | "user";
}

const TreeDefinition = {
  type: "object",
  properties: {
    children: {
      type: "array",
      items: { $ref: "#/$defs/Tree" },
    },
  },
  required: ["children"],
};

const QuerySchema = createStandardSchema({
  type: "object",
  properties: {
    notify: { type: "string", enum: ["yes", "no"] },
    tree: { $ref: "#/$defs/Tree" },
  },
  $defs: { Tree: TreeDefinition },
});

const HeadersSchema = createStandardSchema({
  type: "object",
  properties: {
    "x-api-key": { type: "string", minLength: 1 },
    "x-tree": { $ref: "#/$defs/Tree" },
  },
  required: ["x-api-key"],
  $defs: { Tree: TreeDefinition },
});

defineRouteMeta({
  openAPI: {
    tags: ["users"],
    description: "Creates a user",
  },
});

export default defineValidatedHandler({
  validate: {
    body: z.object({
      name: z.string().min(1),
      age: z.number().int().optional(),
    }),
    query: QuerySchema,
    headers: HeadersSchema,
  },
  async handler(event): Promise<UserResponse> {
    const body = await event.req.json();
    return {
      id: "user-1",
      name: body.name,
      role: "user",
    };
  },
});

function createStandardSchema(jsonSchema: Record<string, any>) {
  return {
    "~standard": {
      version: 1 as const,
      vendor: "nitro-test",
      validate: (value: unknown) => ({ value }),
      jsonSchema: {
        input: () => jsonSchema,
      },
    },
  };
}
