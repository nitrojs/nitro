import { defineRouteMeta } from "nitro";
import { defineHandler } from "nitro/h3";

defineRouteMeta({
  openAPI: {
    parameters: [
      {
        in: "path",
        name: "id",
        required: true,
        description: "Item id",
        schema: { type: "string" },
      },
    ],
  },
});

export default defineHandler((event) => ({ id: event.context.params?.id }));
