/** Export conditions for workerd, which rejects the CJS entries of the `node` condition. */
export function workerdConditions(conditions: string[] = []): string[] {
  return [...new Set(["workerd", "worker", ...conditions.filter((c) => c !== "node")])];
}
