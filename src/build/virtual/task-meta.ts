import type { Nitro } from "nitro/types";

export default function taskMeta(nitro: Nitro) {
  return {
    id: "#nitro/virtual/task-meta",
    template: () =>
      `export const taskMeta = ${JSON.stringify(
        Object.entries(nitro.options.tasks)
          .map(([name, task]) => ({
            name,
            description: task.description,
            implemented: Boolean(task.handler),
          }))
          .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
      )};`,
  };
}
