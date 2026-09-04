import { defineConfig } from "nitro";

// Route patterns whose literal spelling differs from the `event.url.pathname`
// they are matched against. Registered via `handlers` (rather than as file
// names) so the patterns stay literal without odd filenames in the repo.
export const routes = [
  "/について", // non-ASCII
  "/café/menu", // non-ASCII, mid-path
  "/hello world", // space
  "/tag/<x>", // WHATWG-encoded ASCII
  "/%40handle", // needless escape, reaches h3 as `/@handle`
];

export default defineConfig({
  prerender: { routes: ["/について"] },
  handlers: routes.map((route) => ({
    route,
    handler: "./routes/handler.ts",
    method: "GET",
  })),
});
