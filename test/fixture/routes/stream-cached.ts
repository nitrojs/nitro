export default eventHandler(() => {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode("nitro"));
      controller.enqueue(encoder.encode("is"));
      controller.enqueue(encoder.encode("awesome,"));
      controller.enqueue(encoder.encode(Date.now().toString()));
      controller.close();
    },
  });
  return stream;
});
