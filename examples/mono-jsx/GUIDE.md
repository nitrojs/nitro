## Server Entry

```tsx [server.tsx]
export default () => (
  <html>
    <h1>Nitro + mongo-jsx works!</h1>
  </html>
);
```

Nitro auto-detects `server.tsx` and uses mono-jsx to transform JSX into HTML. Export a function that returns JSX, and Nitro sends the rendered HTML as the response.
