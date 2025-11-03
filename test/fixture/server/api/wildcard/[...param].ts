export default defineHandler((event) => {
  return event.context.params!.param as string;
});
