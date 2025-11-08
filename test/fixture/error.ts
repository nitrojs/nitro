import { defineNitroErrorHandler } from "nitro/runtime";

export default defineNitroErrorHandler(
  async (error, event, { defaultHandler }) => {
    if (event.req.url.includes("?json")) {
      const res = await defaultHandler(error, event, { json: true });
      return Response.json({ json: res.body });
    }
  }
);
