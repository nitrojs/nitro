/// <reference types="vite/client" />
import { defineTask } from "nitro/task";
import aliasValue from "task-cli-fixture-alias";
import virtualValue from "virtual:task-cli-fixture";
import hookValue from "virtual:task-cli-hook";

declare const __TASK_CLI_FIXTURE_DEFINE__: string;
declare const __TASK_CLI_HOOK_DEFINE__: string;

export default defineTask({
  run() {
    return {
      result: {
        alias: aliasValue,
        virtual: virtualValue,
        hook: hookValue,
        define: __TASK_CLI_FIXTURE_DEFINE__,
        environment: import.meta.env.TASK_CLI_VALUE,
        hookDefine:
          typeof __TASK_CLI_HOOK_DEFINE__ === "undefined" ? null : __TASK_CLI_HOOK_DEFINE__,
      },
    };
  },
});
