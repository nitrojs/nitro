import { defineNitroErrorHandler } from "nitro/runtime";
import { send } from "h3";
export default defineNitroErrorHandler(
  async (error, event, { defaultHandler }) => {
    if (event.path.includes("?json")) {
      const response = await defaultHandler(error, event, { json: true });
      return send(event, JSON.stringify({ json: response.body }, null, 2));
    }
  }
);
