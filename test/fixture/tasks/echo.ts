export default defineTask({
  meta: {
    name: "echo",
  },
  async run({ payload, context }) {
    return { payload, context };
  },
});
