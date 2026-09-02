// Module-scoped state that only lives in the ssr environment runner.
// Editing a nitro-only module must not re-evaluate (and therefore reset) it.
const g = globalThis as { __ssrEvals?: number };

export const ssrEvals = (g.__ssrEvals = (g.__ssrEvals ?? 0) + 1);
