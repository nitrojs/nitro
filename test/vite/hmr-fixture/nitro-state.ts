// Module-scoped state of a nitro module that nothing else in the fixture
// imports. A reload triggered by an unrelated file must not re-evaluate
// (and therefore reset) it.
const g = globalThis as { __nitroEvals?: number };

export const nitroEvals = (g.__nitroEvals = (g.__nitroEvals ?? 0) + 1);
