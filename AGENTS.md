## Project Identity

Nitro is an (framework and deployment) agnostic server framework powered by [H3](https://github.com/h3js/h3), [UnJS](https://github.com/unjs), and `Vite` | `Rolldown` | `Rollup`.

You are an expert JavaScript and TypeScript developer with strong focus on modern JS tooling and runtime systems.

## Project Setup

- **Language**: TypeScript / JavaScript
- **Package Manager**: `pnpm`
- **Node Version**: >= 22

### First-time Setup for Development

- Run `corepack enable` to ensure `pnpm` is available.
- Run `pnpm install` to install dependencies.
- Run `pnpm build --stub` to prepare development mode.

## Key Scripts

- `pnpm lint` — Lint and format code.
- `pnpm lint:fix` — Automatically fix lint and formatting issues.
- `pnpm test:types` — Run type tests.

**Always run** `pnpm lint:fix` and `pnpm test:types` after making changes.

## Repository Structure

- `.github/` — GitHub Actions workflows.
- `docs/` — Documentation site built with [UnDocs](https://github.com/unjs/undocs).
- `examples/` — Example projects and integrations.
- `src/` — Project source code.
- `test/` — Unit, minimal, and end-to-end tests.

### Code Structure

Project source is centralized under `src/`:

- `src/build` — Build and bundler logic (Vite | Rolldown | Rollup config, virtual templates, plugins).
- `src/cli` — `nitro` CLI subcommands.
- `src/config` — Config defaults and resolvers/normalizers.
- `src/dev` and `src/runner` — Development server logic.
- `src/prerender` — Prerender logic.
- `src/presets` — Deployment presets and runtime entry.
- `src/types` — Shared types.
- `src/utils` — Internal utilities.
- `src/runtime` — Runtime code that goes into the bundle.

## Contribution Principles

- Prefer **minimal, targeted changes** over large refactors.
- Avoid introducing new dependencies unless strictly necessary, add them to `devDependencies` to be bundled unless required in runtime logic.
- Be mindful of **bundle size**, startup cost, and runtime overhead.
- Maintain **backwards compatibility** unless explicitly instructed otherwise.
- Treat changes in `src/` as **high-impact** and review carefully.

## Testing Expectations

- Prefer focused tests that verify behavior and prevent regressions.
- **Always** add regression tests to test/fixture when fixing bugs.
- Keep tests deterministic and environment-independent.

## Error & Logging Guidelines

- Prefer explicit errors over silent failures.
- Use existing logging utilities consistently (`nitro.logger` or `consola` but only `console` for runtime.)
- Use warnings for recoverable situations; throw for invalid states.

## Best Practices

- Use **ESM** and modern JavaScript.
- Prefer **Web APIs** over Node.js APIs where possible.
- Do not add comments explaining what the line does unless prompted.
- Before adding new code, always study surrounding patterns, naming conventions, and architectural decisions.
- Batch multiple related edits together. Avoid sequential micro-changes.
