import fsp from "node:fs/promises";
import { defineNitroPreset } from "nitropack/kit";
import { join } from "pathe";

const _static = defineNitroPreset(
  {
    static: true,
    output: {
      dir: "{{ rootDir }}/.output",
      publicDir: "{{ output.dir }}/public",
    },
    prerender: {
      crawlLinks: true,
    },
    commands: {
      preview: "npx serve {{ output.publicDir }}",
    },
  },
  {
    name: "static" as const,
    static: true,
    url: import.meta.url,
  }
);

const githubPages = defineNitroPreset(
  {
    extends: "static",
    commands: {
      deploy: "npx gh-pages --dotfiles -d {{ output.publicDir }}",
    },
    prerender: {
      routes: [
        "/",
        // https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-custom-404-page-for-your-github-pages-site
        "/404.html",
      ],
    },
    hooks: {
      async compiled(nitro) {
        await fsp.writeFile(
          join(nitro.options.output.publicDir, ".nojekyll"),
          ""
        );
      },
    },
  },
  {
    name: "github-pages" as const,
    static: true,
    url: import.meta.url,
  }
);

const gitlabPages = defineNitroPreset(
  {
    extends: "static",
    prerender: {
      routes: [
        "/",
        // https://docs.gitlab.com/ee/user/project/pages/introduction.html#custom-error-codes-pages
        "/404.html",
      ],
    },
  },
  {
    name: "gitlab-pages" as const,
    static: true,
    url: import.meta.url,
  }
);

export default [_static, githubPages, gitlabPages] as const;
