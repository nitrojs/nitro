---
category: integrations
---

# Shiki

> Syntax highlighting with Shiki and server-side rendering.

## Project Structure

```
shiki/
├── index.html            # HTML with server scripts
├── styles.css            # Syntax theme styles
├── nitro.config.ts
└── vite.config.ts
```

## How It Works

Use Nitro's server scripts to highlight code on the server:

```html [index.html]
<div class="card">
  <script server>
    const hl = (code) =>
      serverFetch("/api/highlight", {
        method: "POST",
        body: code,
      });
  </script>
  <pre><code>{{{ hl(`console.log("💚 Simple is beautiful!");`) }}}</code></pre>
</div>
```

## Learn More

- [Shiki Documentation](https://shiki.style/)
