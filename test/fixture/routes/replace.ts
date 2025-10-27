export default defineEventHandler((event) => {
  // #3672
  globalThis.$window1 = false;
  const { window: window$1 = globalThis } = {};
  return { window: typeof window$1 === "object" && typeof window$1.foo === "function" };
});
