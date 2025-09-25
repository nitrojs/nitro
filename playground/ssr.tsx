/** @jsxImportSource mono-jsx */

// https://github.com/ije/mono-jsx
export default {
  fetch: (req: Request) => (
    <html>
      <h1>Welcome to Nitro playground!</h1>
      <p>
        Routes:
        <ul>
          <li>
            <a href="/server">/server</a>
          </li>
          <li>
            <a href="/route">/route</a>
          </li>
        </ul>
      </p>
    </html>
  ),
};
