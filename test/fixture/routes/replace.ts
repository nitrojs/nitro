export default defineHandler((event) => {
  // #3672
  const { window: window$1 = globalThis } = {};
  return { window: typeof window$1 === "function" };
});
