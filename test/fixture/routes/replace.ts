function foo(options) {
  const { window: window$1 = globalThis } = options;

  return typeof window$1 === "function";
}
