export default () => {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode("nitro"));
      controller.enqueue(encoder.encode("is"));
      controller.enqueue(encoder.encode("awesome"));
      controller.close();
    },
  });
  return stream;
};
