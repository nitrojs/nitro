# Copilot Instructions for Nitro

## Project Overview

Nitro is a framework-agnostic and deployment-agnostic server framework powered by [H3](https://github.com/h3js/h3), [UnJS](https://github.com/unjs), and Vite | Rolldown | Rollup. It extends your Vite app with a production-ready server designed to run anywhere.

## Development Environment

- **Language**: TypeScript / JavaScript (ESM)
- **Package Manager**: `pnpm` (use corepack)
- **Node Version**: >= 22
- **Build Tool**: Vite | Rolldown | Rollup

## Quick Setup

```bash
corepack enable
pnpm install
pnpm build --stub
```

## Essential Commands

- `pnpm build --stub` — Fast stub build for development
- `pnpm lint` — Lint and format code (oxlint + oxfmt)
- `pnpm format` — Auto-fix lint and formatting issues
- `pnpm test` — Run all tests (lint + types + rollup + rolldown)
- `pnpm test:types` — Type checking only
- `pnpm nitro dev ./playground` — Run playground

**Always run `pnpm format` and `pnpm test:types` after making changes.**

## Repository Structure

- `src/` — Core source code (high-impact changes)
  - `src/build` — Build logic, Vite/Rolldown/Rollup config, plugins
  - `src/cli` — CLI commands (one file per command)
  - `src/config/` — Config defaults and resolvers
  - `src/dev` & `src/runner` — Dev server
  - `src/prerender` — Prerendering
  - `src/presets` — Deployment presets and runtime entry
  - `src/runtime` — Runtime code (bundled, platform-agnostic)
  - `src/types` — TypeScript types
  - `src/utils` — Internal utilities
- `test/` — Tests (unit, minimal, e2e)
  - `test/fixture` — Test app (add regression tests here)
  - `test/presets` — Preset-specific tests
- `docs/` — Documentation (built with UnDocs)
- `examples/` — Example integrations
- `playground/` — Development playground

## Code Conventions

### Use UnJS Ecosystem Tools

- **`pathe`** — Cross-platform paths (ALWAYS prefer over `node:path`)
- **`defu`** — Deep merge and config defaults
- **`consola`** — Logging in build/dev (use `nitro.logger` when available)
- **`unstorage`** — Storage abstraction

### Runtime Code Constraints (`src/runtime/`)

Code in `src/runtime/` is bundled and runs across all platforms:

- ❌ **NO Node.js-specific APIs** (unless behind runtime checks)
- ✅ **Prefer Web APIs** (fetch, Request, Response, URL, etc.)
- ✅ **Use `console` for logging** (no `consola` in runtime)
- ✅ **Keep bundle size minimal**
- ✅ **Side-effect free**

### Coding Style

- Use **ESM** and modern JavaScript
- Prefer **Web APIs** over Node.js APIs
- Don't add comments unless necessary or matching existing patterns
- Study surrounding code before adding new patterns
- Use existing UnJS utilities before adding dependencies
- Keep runtime code minimal and fast

### Virtual Modules

Virtual modules must be registered in `src/build/virtual.ts`.

### CLI Commands

Each file in `src/cli/commands/` exports a command definition.

## Testing Requirements

- Run `pnpm test` before submitting
- **Bug fixes MUST include a failing test first**
- Add regression tests to `test/fixture/`
- Keep tests deterministic and environment-independent
- Quick test: `pnpm vitest test/presets/node.test.ts`

## Contribution Guidelines

### Minimal Changes

- Prefer **targeted, surgical changes** over large refactors
- Batch related edits together
- Never modify files outside the scope of the change

### Dependencies

- Avoid new dependencies unless strictly necessary
- Add to `devDependencies` unless required in runtime
- Be mindful of bundle size and startup cost

### Backwards Compatibility

- Maintain backwards compatibility unless explicitly instructed
- Review changes in `src/` carefully for impact on all users
- Consider cross-runtime support

## Common Patterns

### Error Handling

- Prefer explicit errors over silent failures
- Use `nitro.logger` in build/dev, `consola` as fallback
- Use `console` in `src/runtime/` only
- Use warnings for recoverable situations
- Include actionable context in error messages

### Presets

Each preset in `src/presets/<name>/`:
- `runtime/` — Runtime logic and entry
- `*.ts` — Build-time config and utils

## Common Gotchas

- ⚠️ Don't use Node.js APIs in `src/runtime/` (multi-runtime)
- ⚠️ Virtual modules need registration
- ⚠️ Use `pathe` not `node:path`
- ⚠️ Check bundle impact with `pnpm build`
- ⚠️ CLI commands are files in `src/cli/commands/`

## Documentation

- Update `docs/` for user-facing changes
- Update types and JSDoc for API changes
- Add examples to `examples/` for new integrations
- Include migration notes for breaking changes

## When to Ask

- Uncertain about runtime compatibility
- Considering new dependencies
- Breaking changes required
- Architectural decisions in `src/build` or `src/runtime`
- Changing preset behavior
- Modifying virtual module system

## Commit Guidelines

Use semantic commit messages:
- `feat:` — New features
- `fix:` — Bug fixes
- `docs:` — Documentation changes
- `chore:` — Maintenance tasks
- `refactor:` — Code restructuring
- `test:` — Test updates
- `perf:` — Performance improvements
