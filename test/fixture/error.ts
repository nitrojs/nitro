import { defineNitroErrorHandler } from "nitro/runtime";
export default defineNitroErrorHandler(
  async (error, event, { defaultHandler }) => {
    if (event.path.includes("?json")) {
      const response = await defaultHandler(error, event, { json: true });
      return JSON.stringify({ json: response.body }, null, 2);
    }
  }
);
