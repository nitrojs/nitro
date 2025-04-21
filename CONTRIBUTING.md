# Contribution guide

<!-- https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/setting-guidelines-for-repository-contributors -->

> All contributors lead the growth of Nitro - including you!

## Contribute to the code

> [!IMPORTANT]
> Please consider having a discussion with maintainers before opening pull-requests.

### Local development

- Clone [Nitro](https://github.com/nitrojs/nitro) git repository
- Install the latest LTS version of [Node.js](https://nodejs.org/en/) (v22+)
- Enable [Corepack](https://github.com/nodejs/corepack) using `corepack enable` (use `npm i -fg corepack` if not available).
- Install dependencies using `pnpm install`
- Build project in stub mode using `pnpm build --stub`
- Run playground using `pnpm nitro dev ./playground` to verify changes
- Add/modify and run tests using `pnpm test`
  - Tip: you can use `pnpm vitest test/presets/node.test.ts` for a quick test

## Reporting issues

There might have been a bug when using Nitro.

Though we're trying to resolve all the bugs we met, new bugs may emerge with the time lapsed. In this situation, your bug report is the key to helping us find it and fix it in time, even if you can't fix the underlying code of Nitro directly.

Here are some key steps for you to report the bug to us.

## Ensure it's a bug

Sometimes, the thing you want to get help may not be a bug but a feature or other things. Considering the type before you start to report.

## Search the previous issues and discussions

Searching the previous issues and discussions, check if there has an issue or discussion that reported a bug like yours and use 👍 on the original issue (instead of replying "me too" or "when it will be fixed") and if you have more context of issue, like a better/smaller reproduction, please consider to share.

If you feel issue is related but not the same, **making a new issue is always better** choice, maintainers will help to merge similar issues.

## Create a minimal reproduction

It's very important for you to create a minimal reproduction with Nitro(only) starter template.

Sometimes the bug may not occurred by Nitro but other layers. A minimal production can not only help you ensure where the bug comes from, but also help us locate the bug and find a solution as fast as possible.

Please use one of the templates below to create a minimal reproduction:

- [Stackblitz](https://stackblitz.com/fork/github/unjs/nitro-starter)
- [Nitro Starter](https://github.com/nitrojs/nitro-starter)

If the bug report is related to, or using a layer of framework like [Nuxt](https://nuxt.com), please report it to there. Maintainers will help to narrow down issue to a more minimal reproduction.
