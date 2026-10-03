if (!("global" in globalThis)) {
  (globalThis as any).global = globalThis;
}
