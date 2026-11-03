import { isBun } from "std-env";

export function assertBunRuntime() {
  if (!isBun) {
    throw new Error(
      "The `bun` builder requires the Bun runtime. Run Nitro with Bun (e.g. `bun --bun nitro build`) or use another builder."
    );
  }
}
