import { renderUsage } from "citty";
import type { CommandDef } from "citty";
import { stripAnsi } from "consola/utils";
import { hasTTY } from "std-env";

/** Print the usage of a command, without colors when the output is not a terminal and without trailing padding. */
export async function showUsage(cmd: CommandDef<any>, parent?: CommandDef<any>): Promise<void> {
  const usage = (await renderUsage(cmd, parent)).replace(/[ \t]+$/gm, "");
  console.log((hasTTY ? usage : stripAnsi(usage)) + "\n");
}
