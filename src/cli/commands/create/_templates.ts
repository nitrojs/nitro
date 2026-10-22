import { deps } from "../../../utils/_deps.ts";

export interface ProjectTemplate {
  name: string;
  title: string;
  description: string;
  scripts: Record<string, string>;
  devDependencies: Record<string, string>;
  /** Files by path, in addition to the shared ones. */
  files: Record<string, string>;
}

export const projectTemplates: ProjectTemplate[] = [
  {
    name: "vite",
    title: "Vite",
    description: "full-stack app with a frontend",
    scripts: { dev: "vite dev", build: "vite build", preview: "vite preview" },
    devDependencies: { vite: deps.vite.version },
    files: {
      "vite.config.ts": `import { defineConfig } from "vite";
import { nitro } from "nitro/vite";

export default defineConfig({
  plugins: [nitro()],
});
`,
      "index.html": `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Nitro + Vite</title>
  </head>
  <body>
    <h1>Nitro + Vite</h1>
    <button id="hello">Call /api/hello</button>
    <script type="module" src="/app/main.ts"></script>
  </body>
</html>
`,
      "app/main.ts": `const button = document.querySelector<HTMLButtonElement>("#hello")!;

button.addEventListener("click", async () => {
  const res = await fetch("/api/hello");
  button.textContent = await res.text();
});
`,
    },
  },
  {
    name: "rolldown",
    title: "Rolldown",
    description: "API server, bundled for production",
    scripts: { dev: "nitro dev", build: "nitro build", preview: "nitro preview" },
    devDependencies: { rolldown: deps.rolldown.version },
    files: { "index.html": serverIndexHTML() },
  },
  {
    name: "runtime",
    title: "Runtime",
    description: "API server without a build step, experimental",
    scripts: { dev: "nitro dev", start: "nitro start" },
    devDependencies: {},
    files: {
      "nitro.config.ts": `import { defineConfig } from "nitro";

export default defineConfig({
  serverDir: "./server",
  builder: false,
});
`,
      "index.html": serverIndexHTML(),
    },
  },
];

export const sharedFiles: Record<string, string> = {
  "nitro.config.ts": `import { defineConfig } from "nitro";

export default defineConfig({
  serverDir: "./server",
});
`,
  "server/api/hello.ts": `import { defineHandler } from "nitro";

export default defineHandler(() => {
  return { message: "Hello from Nitro!" };
});
`,
  "tsconfig.json": `{
  "extends": "nitro/tsconfig"
}
`,
  ".gitignore": `node_modules
dist
.data
.nitro
.cache
.output
.env
.env.local
`,
  "AGENTS.md": `This is a [Nitro](https://nitro.build) project. Your knowledge of Nitro v3 is likely outdated: refer to https://nitro.build/docs (or run \`npx nitro docs\`).

\`server/\` contains the server code (create subdirectories as needed): \`api/\` (\`/api\` prefixed handlers), \`routes/\`, \`middleware/\`, \`plugins/\`, \`utils/\`, \`assets/\` and \`tasks/\`. \`public/\` holds static assets.
`,
};

function serverIndexHTML(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Nitro</title>
  </head>
  <body>
    <h1>Nitro</h1>
    <p>Edit <code>index.html</code> or <code>server/api/hello.ts</code> to get started.</p>
    <pre>{{{ serverFetch("/api/hello") }}}</pre>
  </body>
</html>
`;
}
