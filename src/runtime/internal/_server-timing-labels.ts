import type { ServerTimingMetric } from "./server-timing.ts";

export function countLabel(one: string, many: string): (metric: ServerTimingMetric) => string {
  return (metric) => `${metric.count} ${metric.count === 1 ? one : many}`;
}

export function cacheStatusLabel(metric: ServerTimingMetric): string | undefined {
  if (!metric.status) {
    return undefined;
  }
  const entries = Object.entries(metric.status);
  if (entries.length === 1 && entries[0][1] === 1) {
    return entries[0][0];
  }
  return entries.map(([status, count]) => `${count} ${status}`).join(", ");
}
