export default defineHandler(() => {
  return {
    testUtil: testUtil(),
    testNestedUtil: testFooUtil() + testBarUtil(),
  };
});
