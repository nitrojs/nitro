/** @jsxImportSource mono-jsx */
import icon from "./nitro.png";

// https://github.com/ije/mono-jsx
export default {
  fetch: (req: Request) => (
    <html>
      <img src={icon} width="64" height="64" alt="Nitro Logo" />
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
