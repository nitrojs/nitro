export function isBunRuntime(): boolean {
  return !!process.versions.bun;
}

export function assertBunRuntime() {
  if (!isBunRuntime()) {
    throw new Error(
      "The `bun` builder requires the Bun runtime. Run Nitro with Bun (e.g. `bun --bun nitro build`) or use another builder."
    );
  }
}
