# Nitro Testing Guide

## Test Structure

```
test/
├── tests.ts            # Main test definitions (shared across presets)
├── fixture/            # Test fixture Nitro app
│   ├── nitro.config.ts
│   ├── routes/         # Test route handlers
│   ├── api/            # Test API handlers
│   ├── middleware/      # Test middleware
│   ├── plugins/        # Test plugins
│   └── public/         # Test static assets
├── presets/            # Per-preset test setup
│   ├── node.test.ts
│   ├── cloudflare.test.ts
│   ├── vercel.test.ts
│   └── ...
├── unit/               # Isolated unit tests
└── minimal/            # Minimal bundle output tests
```

## How Tests Work

1. `test/tests.ts` defines shared test cases using vitest
2. Each `test/presets/<name>.test.ts` imports shared tests and runs them against a specific preset
3. The test fixture in `test/fixture/` is a full Nitro app used as the test target
4. Preset tests build the fixture with the preset, then run HTTP assertions

## Adding Regression Tests

1. Add test route/handler to `test/fixture/` (e.g., `test/fixture/routes/new-feature.ts`)
2. Add test case to `test/tests.ts`
3. Run `pnpm vitest run test/presets/node.test.ts` to verify

## Running Tests

```bash
# Run all tests
pnpm test

# Run specific preset test
pnpm vitest run test/presets/node.test.ts

# Run unit tests
pnpm vitest run test/unit/

# Run minimal bundle test
pnpm vitest run test/minimal/
```

## Bug Fix Workflow

1. Write regression test in `test/fixture/` + `test/tests.ts`
2. Confirm it **fails** (`pnpm vitest run test/presets/node.test.ts`)
3. Fix the implementation
4. Confirm it **passes**
5. Run full suite (`pnpm test`)
