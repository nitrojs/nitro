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
      "unicorn/no-null": 0,
      "no-undef": 0,
      "@typescript-eslint/no-unused-vars": 0,
      "unicorn/filename-case": 0,
      "unicorn/consistent-function-scoping": 0,
      "@typescript-eslint/no-empty-object-type": 0,
      "unicorn/no-empty-file": 0,
      "unicorn/prefer-ternary": 0,
      "unicorn/prefer-single-call": 0,
      "@typescript-eslint/no-unused-expressions": 0,
      // "@typescript-eslint/no-deprecated": "error",
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
