import { defineHandler } from "nitro";

// A dynamic route — spans are named by the matched route template
// (`GET /users/:id`), not the concrete path, to keep cardinality low.
export default defineHandler((event) => ({
  user: { id: event.context.params!.id },
}));
