# Getting Started

🏀 [Online playground](https://stackblitz.com/github/unjs/nitro/tree/main/examples/hello-world) on StackBlitz

Create an empty directory `nitro-app`

```bash
mkdir nitro-app
cd nitro-app
```

Create `routes/index.ts`:

```ts [routes/index.ts]
export default () => 'nitro is amazing!'
```

Start development server:

```bash
npx nitropack dev
```

🪄 Your API is ready at `http://localhost:3000/`

**Tip:** Check `.nitro/dev/index.mjs` if want to know what is happening


You can now build your production-ready server:

```bash
npx nitropack build
````

Output is in the `.output` directory and ready to be deployed on almost any VPS with no dependencies. You can locally try it too:

```bash
node .output/server/index.mjs
```

You can add `nitropack` using your package manager now:

```bash
# npm
npm i -D nitropack

# yarn
yarn add -D nitropack

# pnpm
pnpm i -D nitropack
```
