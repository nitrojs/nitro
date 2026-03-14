import { defineLazyEventHandler, defineHandler } from "nitro/h3";

export default defineLazyEventHandler(async () => {
  // @ts-ignore
  const { sum } = await import("unwasm/examples/sum.wasm").then((r) => r.default());
  return defineHandler(() => {
    return `2+3=${sum(2, 3)}`;
  });
});
