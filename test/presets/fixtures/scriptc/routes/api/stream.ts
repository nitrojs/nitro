import { defineHandler } from "nitro";

export default defineHandler(
  () =>
    new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("a"));
          controller.enqueue(new TextEncoder().encode("b"));
          controller.close();
        },
      })
    )
);
