export default defineHandler(async () => {
  await Promise.resolve(setTimeout(() => {}, 10));
  return await useTest();
});

function useTest() {
  const url = new URL(useRequest().url);
  return {
    context: {
      path: url.pathname + url.search,
    },
  };
}
