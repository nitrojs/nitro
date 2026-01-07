import unjs from "eslint-config-unjs";

export default unjs(
  {
    ignores: [
      "**/.output",
      "**/.tmp",
      "**/.nitro",
      "**/.netlify",
      "**/.vercel",
      "**/.nuxt",
      "**/*.gen.*",
      "**/dist",
    ],
    rules: {
      "no-undef": 0,
      "unicorn/consistent-function-scoping": 0,
      "unicorn/no-empty-file": 0,
      "@typescript-eslint/no-unused-vars": 0,
    },
  }
  // {
  //   languageOptions: {
  //     parserOptions: {
  //       projectService: true,
  //       tsconfigRootDir: import.meta.dirname,
  //     },
  //   },
  // }
);
