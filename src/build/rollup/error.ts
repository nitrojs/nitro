import { isAbsolute, relative } from "pathe";
import type rollup from "rollup";

export function formatRollupError(_error: rollup.RollupError) {
  try {
    const logs: string[] = [_error.toString()];
    const errors = (_error as any)?.errors || [_error as rollup.RollupError];
    for (const error of errors) {
      const id = (error as any).path || error.id || (_error as rollup.RollupError).id;
      let path = isAbsolute(id) ? relative(process.cwd(), id) : id;
      const location = (error as rollup.RollupError).loc;
      if (location) {
        path += `:${location.line}:${location.column}`;
      }
      const text = (error as rollup.RollupError).frame;
      logs.push(`Rollup error while processing \`${path}\`` + text ? "\n\n" + text : "");
    }
    return logs.join("\n");
  } catch {
    return _error?.toString();
  }
}
