import "./server/utils/register-items.ts";
import { getItems } from "./server/utils/registry.ts";

export default {
  fetch(_req: Request) {
    return Response.json({ items: getItems() });
  },
};
