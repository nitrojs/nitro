---
name: update-deps
description: >
  Update and audit dependencies in the Nitro monorepo using pnpm. Handles non-major upgrades,
  pre-release version tracking, workspace link-reference fixes, and lockfile regeneration.
  Use when upgrading packages, checking for outdated dependencies, fixing version conflicts,
  or preparing a dependency-update PR in this repository.
---

# Update Dependencies

## Step-by-Step Process

### 1. Ensure Clean State

```bash
git checkout main
git pull origin main
git status  # Should show "nothing to commit, working tree clean"
```

(if branch name starts with chore, you can stay in it, no need to pull or change branch or clean state)

### 2. Initial Install

```bash
pnpm install
```

### 3. Run pnpm upgrade -r

Run `pnpm upgrade -r` to update non-major versions. After upgrade, check git diff:

- Make sure range types does not change in `dependencies` field (example: `"h3": "^2.0.1-rc.7"` should remain `"h3": "^2.0.1-rc.7",` not `"h3": "2.0.1-rc.7",`)
- Make sure dependencies are not converted to `link:..` (example: `"nitro": "latest",` should remain same, instead of `"nitro": "link:../.."`)

**Fix workspace package link references:**

`pnpm upgrade -r` often incorrectly converts workspace package references (like `"nitro": "latest"`) to link format (`"nitro": "link:../.."`) in monorepo packages.

Check git diff for any workspace packages that were converted to `link:` format:

```bash
# Check for any link: conversions in modified files
git diff --name-only | xargs grep -l '"link:' 2>/dev/null
```

If found, revert them back to their original format. For this repo, `"nitro"` should always be `"latest"`:

```bash
# Revert nitro link references back to latest in all modified package.json files
git diff --name-only | grep 'package.json$' | while read file; do
  if grep -q '"nitro": "link:' "$file" 2>/dev/null; then
    sed -i 's/"nitro": "link:[^"]*"/"nitro": "latest"/g' "$file"
    echo "Fixed: $file"
  fi
done
```

**Fix caret prefix removal:**

If any dependencies in root `package.json` lost their `^` prefix, restore them manually.

**CHECKPOINT**: Verify `git diff` shows no `link:` conversions and no dropped `^` prefixes before continuing.

### 4. Check for Outdated Dependencies

```bash
pnpm outdated -r
```

**IMPORTANT**: Check for newer beta/alpha/rc versions manually. `pnpm outdated` doesn't show pre-release updates.

Check each package with beta/alpha/rc versions in package.json:

```bash
# List all versions including pre-releases
pnpm show vite versions --json | grep -E "beta|alpha|rc" | tail -5
pnpm show youch versions --json | grep -E "beta|alpha|rc" | tail -5
```

Or check all versions for a specific package:

```bash
pnpm show <package-name> versions
```

### 5. Update Dependencies

Manually update all dependencies to their latest versions in [package.json](../package.json):

- Update both `dependencies` and `devDependencies`
- Keep the range prefix (e.g., `^` for caret ranges)
- **For beta/alpha/rc packages**: Update to the latest pre-release tag found in step 4
  - Example: `vite: "8.0.0-beta.6"` → `"8.0.0-beta.7"`
  - Example: `h3: "^2.0.1-rc.7"` → `"^2.0.1-rc.8"` (if available)
- Maintain version range conventions (prefer `^` over exact versions)
- **Do not update** `@azure/functions`

### 6. Clean Install

Remove lock file and node_modules, then reinstall:

```bash
rm -rf node_modules pnpm-lock.yaml
pnpm i
```

### 7. Lint and Fix

```bash
pnpm format
```

### 8. Build Project

```bash
pnpm build
```

**CHECKPOINT**: Build must succeed before continuing. If it fails, see Common Issues below.

### 9. Fix Remaining Issues

If there are lint or type errors:

1. Review the output carefully
2. Fix issues manually following the project conventions
3. Re-run `pnpm format` to verify lint fixes
4. Re-run `pnpm typecheck` to verify type fixes. Ignore errors, only report them in the end.

### 10. Summary

Do not commit changes. Only summarize what happened.

## Common Issues

### Breaking Changes

If a dependency has breaking changes:

- Check the package's changelog/release notes
- Update code to match new API if needed
- Consider pinning to previous major version if breaking changes are too extensive

### Build Failures

If the build fails after updates:

- Check for TypeScript errors first: `pnpm typecheck`
- Review error messages for deprecated APIs
- Consider updating dependencies one at a time to isolate issues

### Lock File Conflicts

- Test thoroughly after updates, especially major version bumps
- Review changelogs for significant updates
