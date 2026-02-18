export default defineEventHandler(async (event) => {
  return { value: await func(Math.random()) };
});

const func = defineCachedFunction(
  (testValue: number): number => {
    return testValue;
  },
  {
    validate(entry, testValue) {
      return entry.value !== undefined && testValue !== undefined;
    },
    maxAge: 10,
    getKey() {
      return "testCachedFunction";
    },
  }
);
