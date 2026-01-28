---
category: vite
---

# Vite RSC

> React Server Components with Vite and Nitro.

## Project Structure

```
vite-rsc/
├── app/
│   ├── root.tsx          # Root server component
│   ├── client.tsx        # Client components
│   ├── action.tsx        # Server actions
│   ├── framework/
│   │   ├── entry.browser.tsx
│   │   ├── entry.rsc.tsx
│   │   └── entry.ssr.tsx
│   └── assets/
├── vite.config.ts
└── tsconfig.json
```

## How It Works

This example demonstrates React Server Components (RSC) with Vite's experimental RSC plugin, integrated with Nitro.

### Server Components

Server components run only on the server:

```tsx [app/root.tsx]
export default async function Root() {
  const data = await fetchData();
  return <div>{data}</div>;
}
```

### Client Components

Mark client components with `"use client"`:

```tsx [app/client.tsx]
"use client";
export function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

## Learn More

- [React Server Components](https://react.dev/reference/rsc/server-components)
