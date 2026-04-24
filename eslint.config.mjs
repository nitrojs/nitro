import unjs from "eslint-config-unjs";

export default unjs({
  ignores: [
    "**/.output",
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
    "unicorn/prefer-single-call": 0,
  },
});
