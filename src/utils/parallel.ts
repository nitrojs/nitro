export async function runParallel<T>(
  inputs: Set<T>,
  cb: (input: T) => unknown | Promise<unknown>,
  opts: { concurrency: number; interval?: number }
): Promise<{ errors: unknown[] }> {
  const errors: unknown[] = [];
  const tasks = new Set<Promise<unknown>>();

  function queueNext(): undefined | Promise<unknown> {
    const route = inputs.values().next().value;
    if (!route) {
      return;
    }

    inputs.delete(route);
    const task = (
      opts.interval
        ? new Promise((resolve) => setTimeout(resolve, opts.interval))
        : Promise.resolve()
    )
      .then(() => cb(route))
      .catch((error) => {
        console.error(error);
        errors.push(error);
      });

    tasks.add(task);
    return task.then(() => {
      tasks.delete(task);
      if (inputs.size > 0) {
        return refillQueue();
      }
    });
  }

  function refillQueue(): Promise<unknown> {
    const workers = Math.min(opts.concurrency - tasks.size, inputs.size);
    return Promise.all(Array.from({ length: workers }, () => queueNext()));
  }

  await refillQueue();

  return { errors };
}
