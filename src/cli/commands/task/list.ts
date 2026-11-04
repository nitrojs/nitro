import { defineCommand } from "citty";
import { consola } from "consola";
import { resolve } from "pathe";

export default defineCommand({
  meta: {
    name: "list",
    description: "List available tasks (experimental)",
  },
  args: {
    dir: {
      type: "string",
      description: "project root directory",
    },
  },
  async run({ args }) {
    const { listTasks, loadOptions } = await import("nitro/builder");
    const cwd = resolve((args.dir || args.cwd || ".") as string);
    const options = await loadOptions({ rootDir: cwd }).catch(() => undefined);

    const tasks = await listTasks({
      cwd,
      buildDir: options?.buildDir || ".nitro",
    });
    for (const [name, task] of Object.entries(tasks)) {
      consola.log(` - \`${name}\`${task.meta?.description ? ` - ${task.meta.description}` : ""}`);
    }
  },
});
