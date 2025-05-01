import { defineCommand } from "citty";
import { consola } from "consola";
import { listTasks, loadOptions } from "nitropack/core";
import { resolve } from "pathe";

export default defineCommand({
  meta: {
    name: "run",
    description: "List available tasks (experimental)",
  },
  args: {
    dir: {
      type: "string",
      description: "project root directory",
    },
  },
  async run({ args }) {
    const cwd = resolve((args.dir || args.cwd || ".") as string);
    const rootDir = args.dir || args.cwd ? cwd : undefined;
    const options = await loadOptions({ rootDir }, { cwd }).catch(
      () => undefined
    );

    const tasks = await listTasks({
      cwd: options?.rootDir || cwd,
      buildDir: options?.buildDir || ".nitro",
    });
    for (const [name, task] of Object.entries(tasks)) {
      consola.log(
        ` - \`${name}\`${
          task.meta?.description ? ` - ${task.meta.description}` : ""
        }`
      );
    }
  },
});
