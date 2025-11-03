export default defineHandler(() => {
  return { foo: new Map<string, number>([["key", 2]]) };
});
