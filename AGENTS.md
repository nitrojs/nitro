# Nitro AI Agent Guide

This document provides comprehensive information for AI agents working on the Nitro codebase.

## Project Overview

Nitro is a next generation server toolkit. This is a monorepo using pnpm workspaces with the following key characteristics:

- **Language**: TypeScript/JavaScript
- **Package Manager**: pnpm (required)
- **Node Version**: ^20.0.0 || ^22.0.0 || >=24.0.0
- **Build System**: obuild

## Setup and Development

### Initial Setup
1. Run `pnpm install` to install dependencies
2. Run `pnpm build` to build all packages

### Key Scripts
- `pnpm build` - Build all packages
- `pnpm dev` - Watch mode for development
- `pnpm lint` - Run ESLint
- `pnpm lint:fix` - Fix linting issues automatically

### Important Directories
- `docs/` - Documentation
- `examples/` - Example projects and integrations
- `scripts/` - Build and development scripts
- `.github/` - GitHub Actions workflows

## Code Style and Conventions

### Formatting and Linting
- **Always run** `pnpm lint:fix` after making changes
- Fix non-auto-fixable errors manually

### Code Quality
- ESM-first approach
- Follow existing patterns in the codebase
- Do not add comments explaining what the line does unless prompted to.

## Common Workflows

### Documentation
- Main docs in `docs/` directory
- Built with `pnpm build`
- Local dev server: `pnpm dev`
