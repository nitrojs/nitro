import { send } from "@vercel/queue";
import { defineHandler, HTTPError } from "nitro";

export default defineHandler(async (event) => {
  const body = (await event.req.json()) as Record<string, unknown>;
  if (!body.to || !body.subject || !body.body) {
    throw new HTTPError({
      status: 400,
      message: "Missing required fields `to`, `subject` or `body`",
    });
  }

  const { messageId } = await send("notifications", {
    to: body.to,
    subject: body.subject,
    body: body.body,
  });
  return { messageId };
});
