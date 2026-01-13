# Update Dependencies Skill

This skill guides you through the process of updating dependencies in the Nitro repository.

## Step-by-Step Process

### Ensure Clean State

Check that you're on a clean main branch with latest changes.

- Clean working directory on main branch
- Latest changes pulled from remote

```bash
git checkout main
git pull origin main
git status  # Should show "nothing to commit, working tree clean"
```

(if branch name starts with chore, you can stay in it, no need to pull or change branch or clean state)

### Initial Install

Run an initial install to ensure everything is up to date:

```bash
pnpm install
```

### Run pnpm upgrade -r

Run `pnpm upgrade -r` to update non-major versions.

After upgrade, check git diff:

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

### Check for Outdated Dependencies

Find outdated dependencies:

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

### 4. Update Dependencies

Manually update all dependencies to their latest versions in [package.json](../package.json):

- Update both `dependencies` and `devDependencies`
- Keep the range prefix (e.g., `^` for caret ranges)
- **For beta/alpha/rc packages**: Update to the latest pre-release tag found in step 3
  - Example: `vite: "8.0.0-beta.6"` → `"8.0.0-beta.7"`
  - Example: `h3: "^2.0.1-rc.7"` → `"^2.0.1-rc.8"` (if available)
- Maintain version range conventions (prefer `^` over exact versions)
- **Do not update** `@azure/functions`

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

### 9. Fix Remaining Issues

If there are lint or type errors:

1. Review the output carefully
2. Fix issues manually following the project conventions
3. Re-run `pnpm lint:fix` to verify lint fixes
4. Re-run `pnpm test:types` to verify type fixes. Ignore errors, only report them in the end.

### 10. Final

Do not commit changes. Only summarize what happened.

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

- Test thoroughly after updates, especially major version bumps
- Review changelogs for significant updates
