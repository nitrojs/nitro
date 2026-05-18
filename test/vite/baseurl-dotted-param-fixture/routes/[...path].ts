import type { EventHandler } from "h3";

export default ((event) => {
  const path = event.context.params?.path ?? "";
  return `root-wildcard:${path}`;
}) satisfies EventHandler;
