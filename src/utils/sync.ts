/**
 * Call `fn` with a value, or with the value of a promise once it resolves.
 *
 * Keeps plugin hooks synchronous where the context is (`this.resolve()` of env-runner's
 * self runner returns its result directly), and async with bundlers.
 */
export function chain<T, R>(value: T | PromiseLike<T>, fn: (value: T) => R): R | Promise<R> {
  return isPromiseLike(value) ? Promise.resolve(value).then(fn) : fn(value);
}

function isPromiseLike<T>(value: T | PromiseLike<T>): value is PromiseLike<T> {
  return typeof (value as PromiseLike<T> | undefined)?.then === "function";
}
