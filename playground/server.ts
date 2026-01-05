export default {
  fetch(req: Request) {
    setTimeout(() => {
      process.exit(1);
    }, 1000);
    return new Response("Hello from Nitro playground!!");
  },
};
