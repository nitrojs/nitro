# Update Dependencies Skill

This skill guides you through the process of updating dependencies in the Nitro repository.

## Prerequisites

- Clean working directory on main branch
- Latest changes pulled from remote

## Step-by-Step Process

### 1. Ensure Clean State

Check that you're on a clean main branch with latest changes:

```bash
git checkout main
git pull origin main
git status  # Should show "nothing to commit, working tree clean"
```

### 2. Initial Install

Run an initial install to ensure everything is up to date:

```bash
pnpm i
```

### 3. Check for Outdated Dependencies

Find outdated dependencies:

```bash
pnpm outdated
```

For any pinned beta tags or specific versions, check for the latest version manually:

```bash
pnpm show <package-name>
```

This will display all available versions including beta/alpha tags.

### 4. Update Dependencies

Manually update all dependencies to their latest versions in [package.json](../package.json):

- Keep the range prefix (e.g., `^` for caret ranges)
- Update both `dependencies` and `devDependencies`
- For beta/alpha packages, update to the latest tag found in step 3
- Maintain version range conventions (prefer `^` over exact versions)

Example:
```json
{
  "dependencies": {
    "package-a": "^1.2.3"  // Update to ^1.3.0
  },
  "devDependencies": {
    "package-b": "^2.1.0"  // Update to ^2.2.0
  }
}
```

### 5. Clean Install

Remove lock file and node_modules, then reinstall:

```bash
rm -rf node_modules pnpm-lock.yaml
pnpm i
```

### 6. Lint and Fix

Run linting and auto-fix issues:

```bash
pnpm lint:fix
```

### 7. Build Project

Build the project to ensure compatibility:

```bash
pnpm build
```

### 8. Type Check

Run type tests to catch any TypeScript issues:

```bash
pnpm test:types
```

### 9. Fix Remaining Issues

If there are lint or type errors:

1. Review the output carefully
2. Fix issues manually following the project conventions
3. Re-run `pnpm lint:fix` to verify lint fixes
4. Re-run `pnpm test:types` to verify type fixes

### 10. Run Full Tests

Before committing, run the full test suite:

```bash
pnpm vitest run
```

## Common Issues

### Breaking Changes

If a dependency has breaking changes:

- Check the package's changelog/release notes
- Update code to match new API if needed
- Consider pinning to previous major version if breaking changes are too extensive

### Build Failures

If the build fails after updates:

- Check for TypeScript errors first: `pnpm test:types`
- Review error messages for deprecated APIs
- Consider updating dependencies one at a time to isolate issues

### Lock File Conflicts

If you encounter lock file issues:

- Ensure you're using the correct pnpm version (check `.nvmrc` for Node version)
- Run `corepack enable` to ensure pnpm is properly configured

## Best Practices

- Update dependencies regularly (e.g., weekly or bi-weekly)
- Test thoroughly after updates, especially major version bumps
- Review changelogs for significant updates
- Update related packages together (e.g., all eslint plugins)
- Keep an eye on bundle size impact for runtime dependencies
- For runtime dependencies, verify cross-runtime compatibility

## Notes

- This is a manual process to give you control over each update
- Always review the changes before committing
- Breaking changes should be documented if they affect users
- Runtime dependencies require extra scrutiny (check [src/runtime/](../src/runtime/))
