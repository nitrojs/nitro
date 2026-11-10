import type { ArgsDef } from "citty";
import { kebabCase } from "scule";

export interface ArgsErrorOptions {
  /** Valid values of string flags, listed when a value is missing. */
  choices?: Record<string, string[]>;
}

/**
 * Find an unknown flag, a string flag without a value or an unexpected positional argument.
 *
 * citty parses arguments loosely: without this check, a typo or a guessed flag is silently ignored.
 */
export function findArgsError(
  rawArgs: string[],
  argsDef: ArgsDef,
  opts: ArgsErrorOptions = {}
): string | undefined {
  const flags = new Map<string, string>();
  for (const [name, def] of Object.entries(argsDef)) {
    if (def.type === "positional") {
      continue;
    }
    const aliases = "alias" in def && def.alias ? [def.alias].flat() : [];
    for (const flag of [name, kebabCase(name), ...aliases]) {
      flags.set(flag, name);
    }
  }

  const positionals: string[] = [];
  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i]!;
    if (arg === "--") {
      positionals.push(...rawArgs.slice(i + 1));
      break;
    }
    if (!arg.startsWith("-") || arg === "-") {
      positionals.push(arg);
      continue;
    }
    const [flag, value] = splitOnce(arg.replace(/^--?/, ""), "=");
    const negated = flag.startsWith("no-") && !flags.has(flag);
    const name = flags.get(negated ? flag.slice(3) : flag);
    if (!name) {
      const suggestion = suggestFlag(flag, [...flags.keys()]);
      return `Unknown option \`${arg}\`.${suggestion ? ` Did you mean \`${suggestion}\`?` : ""} Run \`nitro create --help\` to see all options.`;
    }
    if (argsDef[name]!.type !== "string" || negated) {
      const next = rawArgs[i + 1];
      if (!negated && value === undefined && (next === "true" || next === "false")) {
        return `Unexpected argument \`${next}\` after \`${arg}\`. Use \`${arg}\` or \`--no-${flag.replace(/^-/, "")}\` instead.`;
      }
      continue;
    }
    if (value === undefined && rawArgs[i + 1] !== undefined && !rawArgs[i + 1]!.startsWith("-")) {
      i++;
    } else if (!value) {
      const choices = opts.choices?.[name];
      return `Missing value for \`${arg.split("=")[0]}\`.${choices ? ` Use one of: ${choices.join(", ")}.` : ""}`;
    }
  }

  const maxPositionals = Object.values(argsDef).filter((def) => def.type === "positional").length;
  if (positionals.length > maxPositionals) {
    return `Unexpected argument \`${positionals[maxPositionals]}\`. Only one directory can be created at a time.`;
  }
}

function splitOnce(str: string, separator: string): [string, string | undefined] {
  const index = str.indexOf(separator);
  return index === -1 ? [str, undefined] : [str.slice(0, index), str.slice(index + 1)];
}

function suggestFlag(flag: string, flags: string[]): string | undefined {
  const lower = flag.toLowerCase();
  const match =
    flags.find((f) => f.toLowerCase() === lower) ||
    flags.find((f) => f.length > 1 && (f.startsWith(lower) || lower.startsWith(f.toLowerCase()))) ||
    flags.find((f) => f.length > 3 && editDistance(lower, f.toLowerCase()) <= 2);
  return match && (match.length === 1 ? `-${match}` : `--${match}`);
}

/** Levenshtein distance, counting a swap of two adjacent characters as one edit. */
function editDistance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i]![j] = Math.min(d[i]![j]!, d[i - 2]![j - 2]! + 1);
      }
    }
  }
  return d[a.length]![b.length]!;
}
