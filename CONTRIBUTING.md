# Contribution Guide

<!-- https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/setting-guidelines-for-repository-contributors -->

> All contributors lead the growth of Nitro - including you!

## Discussions

You can involve in discussions using:

- [Github Discussions](discussions)
- [Nitro Discord](https://discord.nitro.build)

## Contribute to the Code

> [!IMPORTANT]
> Please discuss your ideas with the maintainers before opening a pull request.

### Local Development

- Clone the [Nitro](https://github.com/nitrojs/nitro) repository.
- Install the latest LTS version of [Node.js](https://nodejs.org/en/) (v22+).
- Enable [Corepack](https://github.com/nodejs/corepack) using `corepack enable` (run `npm i -g corepack` if it's not available).
- Install dependencies using `pnpm install`.
- Build the project in stub mode using `pnpm build --stub`.
- Run the playground with `pnpm nitro dev ./playground` to verify changes.
- Add, modify, and run tests using `pnpm test`.
  - Tip: Run `pnpm vitest test/presets/node.test.ts` for quick testing.

## Reporting Issues

You might encounter a bug while using Nitro.

Although we aim to resolve all known issues, new bugs can emerge over time. Your bug report helps us find and fix them faster — even if you're unable to fix the underlying code yourself.

Here’s how to report a bug effectively:

### Ensure It's a Bug

Sometimes what seems like a bug may actually be expected behavior or a missing feature. Make sure you’re reporting an actual bug by creating a minimal nitro project and reducing scope.

### Create a Minimal Reproduction

Please create a minimal reproduction using the Nitro starter templates.

Sometimes, bugs originate from another layer — not Nitro itself. A minimal reproduction helps identify the source and speeds up debugging.

Use one of the following templates to reproduce the issue:

- [Stackblitz Template](https://stackblitz.com/fork/github/nitrojs/nitro-starter)
- [Nitro Starter Repo](https://github.com/nitrojs/nitro-starter)

If your bug involves a higher-level framework like [Nuxt](https://nuxt.com), please report it there. Maintainers will help narrow it down to a Nitro-level issue if needed.

### Search Existing Issues and Discussions

Before creating a new issue, search existing [issues](https://github.com/nitrojs/nitro/issues) and [discussions](https://github.com/nitrojs/nitro/discussions) to see if your bug has already been reported.

If it has:
- Add a 👍 reaction to the original post (instead of commenting "me too" or "when will it be fixed").
- If you can provide additional context or a better/smaller reproduction, please share it.

If the issue seems related but different, it's **better to open a new issue**. Maintainers will merge similar issues if needed.

