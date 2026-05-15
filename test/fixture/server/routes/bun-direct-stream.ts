export default () => {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    // @ts-expect-error - direct is a Cloudflare extension
    type: "direct",
    start(controller) {
      controller.enqueue(encoder.encode("bun-direct"));
      controller.close();
    },
  });

  return {
    isStream: stream instanceof ReadableStream,
  };
};
