export default defineEventHandler(() => {
  return {
    testUtil: testUtil(),
    testNestedUtil: testFooUtil() + testBarUtil(),
  };
});
