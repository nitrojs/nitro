import { fileURLToPath } from "node:url";

export default {
  resolve: {
    alias: {
      "task-cli-fixture-alias": fileURLToPath(new URL("./alias.ts", import.meta.url)),
    },
  },
  define: {
    __TASK_CLI_FIXTURE_DEFINE__: JSON.stringify("vite define"),
    "import.meta.env.TASK_CLI_VALUE": JSON.stringify("vite environment"),
  },
  plugins: [
    {
      name: "fixture:task-cli-virtual",
      resolveId(id: string) {
        if (id === "virtual:task-cli-fixture") return "\0task-cli-fixture";
      },
      load(id: string) {
        if (id === "\0task-cli-fixture") return 'export default "virtual value"';
      },
    },
  ],
};
