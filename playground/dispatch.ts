import { defineHandler } from "h3";

declare global {
  interface RequestInit {
    env?: string;
  }
}

export default defineHandler(async (event) => {
  console.log(`[${event.req.method}] ${event.url}`);
  const { service } =
    event.url.pathname === "/" ? { service: "landing" } : event.context.params!;
  return fetch("/", { env: service });
});
