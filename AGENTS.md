## Project Identity

Nitro is a framework-agnostic and deployment-agnostic server framework powered by [H3](https://github.com/h3js/h3), [UnJS](https://github.com/unjs), and Vite | Rolldown | Rollup.

You are an expert JavaScript and TypeScript developer with strong focus on modern JS tooling and runtime systems.

## Project Setup

- **Language**: TypeScript / JavaScript
- **Package Manager**: `pnpm`
- **Node Version**: >= 22

## First-time Setup for Development

- Run `corepack enable` to ensure `pnpm` is available.
- Run `pnpm install` to install dependencies.
- Run `pnpm build --stub` to prepare development mode.

## Key Scripts

- `pnpm build --stub` — Fast stub build for development.
- `pnpm lint` — Lint and format code.
- `pnpm lint:fix` — Automatically fix lint and formatting issues.
- `pnpm test` — Run all tests.
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

- `src/build` — Build logic (Vite | Rolldown | Rollup config, virtual templates, plugins).
- `src/cli` — `nitro` CLI subcommands (each file in `src/cli/commands` is a command).
- `src/config/` — Config defaults (`src/config/defaults.ts`) and resolvers/normalizers (`src/config/resolvers`).
- `src/dev` and `src/runner` — Development server logic.
- `src/prerender` — Prerender logic.
- `src/presets` — Deployment presets and runtime entry.
- `src/types` — Shared types.
- `src/utils` — Internal utilities.
- `src/runtime` — Runtime code that goes into the bundle (runtime and platform agnostic).

### Why Changes in `src/` Are High-Impact

Code in `src/` affects all Nitro users:

- Changes in `src/runtime` are bundled and run across all deployment targets.
- Changes in `src/build` affect build output and performance.
- Changes in `src/presets` affect specific deployment platforms.
- Changes in `src/config` affect default behavior.

Review these changes carefully for backwards compatibility, bundle size, and cross-runtime support.

## Code Patterns & Conventions

- `pathe` — Cross-platform path operations (always prefer over `node:path`).
- `defu` — Deep object merging and config defaults.
- `consola` — Logging in build/dev code (use `nitro.logger` when available).
- `unstorage` — Storage abstraction.

### Runtime Constraints

Code in `src/runtime/` must be runtime-agnostic:

- **Don't use Node.js-specific APIs** (unless behind runtime checks).
- Prefer **Web APIs** (fetch, Request, Response, URL, etc.).
- Only use `console` for logging (no `consola` in runtime).
- Keep bundle size minimal and side-effect free.

## Testing Strategy

### Test Structure

Main tests are defined in `test/tests.ts` and setup per each deployment provider in `test/presets` and run against `test/fixture` nitro app. Add new regression tests to `test/fixture`.

Other tests:

- **Unit** (`test/unit/`) — Isolated unit tests.
- **Minimal** (`test/minimal/`) — Smallest bundle output.

### Testing Requirements

- Run `pnpm run test` before submitting.
- **Bug fixes MUST include a failing test first** — add regression tests to `test/fixture/` and make sure test script fails before attempting the fix and resolves after.
- Keep tests deterministic and environment-independent.

## Working with Presets

Each preset in `src/presets/` defines deployment target behavior:

- Runtime logic and entry is in `src/presets/<name>/runtime`
- Preset config and utils (build time) are in `src/presets/<name>/*.ts`.

## Development Workflow

### Making Changes

1. Make changes in `src/`.
2. Run `pnpm build --stub` if you changed build logic.
3. Test with `pnpm test`.
4. Run `pnpm lint:fix`.
5. Run `pnpm test:types`.
6. Run `pnpm vitest run`.

## Contribution Principles

- Prefer **minimal, targeted changes** over large refactors.
- Avoid introducing new dependencies unless strictly necessary.
  Add them to `devDependencies` unless they are required in runtime logic.
- Be mindful of **bundle size**, startup cost, and runtime overhead.
- Maintain **backwards compatibility** unless explicitly instructed otherwise.
- Batch multiple related edits together. Avoid sequential micro-changes.
- Never modify files outside the scope of the requested change.

## Common Gotchas

- **Don't use Node.js-specific APIs in `src/runtime/`** — Code runs in multiple runtimes (Node, workers, edge).
- **Virtual modules must be registered** in `src/build/virtual.ts`.
- **CLI commands** are in `src/cli/commands/` — Each file exports a command definition.
- **Runtime size matters** — Check bundle impact with `pnpm build`.
- **Use `pathe` not `node:path`** — Ensures cross-platform compatibility.

## Error & Logging Guidelines

- Prefer explicit errors over silent failures.
- Use `nitro.logger` in build/dev code, `consola` as fallback.
- Use `console` only in `src/runtime/` code.
- Use warnings for recoverable situations; throw for invalid states.
- Include actionable context in error messages.

## Documentation Requirements

- Update `docs/` for user-facing changes.
- Update types and JSDoc for API changes.
- Examples in `examples/` should reflect best practices and be added for new integrations.
- Add migration notes for breaking changes.

## When to Ask

Reach out or flag for review when:

- Uncertain about runtime compatibility.
- Considering new dependencies.
- Breaking changes are required.
- Making architectural decisions in `src/build` or `src/runtime`.
- Changing preset behavior.
- Modifying virtual module system.

## Best Practices

- Use **ESM** and modern JavaScript.
- Prefer **Web APIs** over Node.js APIs where possible.
- Do not add comments explaining what the line does unless prompted.
- Before adding new code, always study surrounding patterns, naming conventions, and architectural decisions.
- Use existing UnJS utilities and dependencies before adding new packages.
- Keep runtime code minimal and fast.
