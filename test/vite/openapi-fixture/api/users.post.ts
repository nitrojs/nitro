import { defineRouteMeta } from "nitro";
import { defineValidatedHandler } from "nitro/h3";
import { z } from "zod";

interface UserResponse {
  id: string;
  name: string;
  active?: boolean;
  role: "admin" | "user";
}

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
    query: z.object({
      notify: z.enum(["yes", "no"]).optional(),
    }),
    headers: z.object({
      "x-api-key": z.string().min(1),
    }),
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
