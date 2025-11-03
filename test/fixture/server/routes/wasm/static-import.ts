// @ts-ignore
import init, { sum } from "unwasm/examples/sum.wasm";

export default lazyEventHandler(async () => {
  await init();
  return defineHandler(() => {
    return `2+3=${sum(2, 3)}`;
  });
});
