import { H3 } from "h3";

const app = new H3();

app.get("/", (event) => {
  event.res.headers.set("content-type", "text/html");
  return `<img src="/image.png" />`;
});

app.get("/image.png", (event) => {
  event.res.headers.set("content-type", "image/png");
  return "PNGDATA";
});

app.get("/generated.js", () => "console.log('generated')");

app.get("/generated.js.map", () => Response.json({ version: 3, mappings: "" }));

app.post("/upload.png", () => Response.json({ uploaded: true }));

export default app;
