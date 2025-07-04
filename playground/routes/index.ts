import { defineHandler, html } from "h3";

// @ts-ignore
import viteLogo from "../assets/vite.svg";
// const nitroLogo = "https://nitro.build/icon.svg";

// @ts-ignore
import nitroLogo from "../assets/nitro.svg";
// const viteLogo = "https://vitejs.dev/logo.svg";

export default defineHandler(async (event) => {
  return html(
    event,
    /* html */ `
  <!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vite ＋ Nitro</title>
    <style>
      body {
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100vh;
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
      }
      #app {
        text-align: center;
      }
      img {
        width: 200px;
      }
      .logo-container {
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 150px;
        font-weight: bold;
        color:rgb(255, 255, 255);
        text-align: center;
        user-select: none;
      }
    </style>
  </head>
  <body>
    <div id="app">
      <div class="logo-container">
        <img src="${viteLogo}" alt="Vite logo" width="200" />
        <span id="plus">＋</span>
        <img src="${nitroLogo}" alt="Nitro logo" width="200" />
      </div>
      <h1>Vite + Nitro</h1>
    </div>
    <script module>
      document.addEventListener('click', () => {
        move(document.querySelector('#app'));
      });

      function move(el) {
        const rect = el.getBoundingClientRect();
        let x = rect.left, y = rect.top;
        let dx = Math.random() > 0.5 ? 4 : -4, dy = Math.random() > 0.5 ? 4 : -4;
        const m = () => {
          const w = window.innerWidth - el.offsetWidth;
          const h = window.innerHeight - el.offsetHeight;
          x += dx;
          y += dy;
          if (x <= 0 || x >= w) dx *= -1;
          if (y <= 0 || y >= h) dy *= -1;
          el.style.left = x + 'px';
          el.style.top = y + 'px';
          requestAnimationFrame(m);
        }
        el.style.position = 'absolute';
        m()
      }
    </script>
  </body>
</html>
  `
  );
});
