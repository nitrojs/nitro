export default () => {
  const links = ["/api/hello", "/api/param/foo.json", "/api/param/foo.css"];

  return `<!DOCTYPE html><html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Prerendered routes test</title>
</head>
<body>
  <h1>Prerendered routes test #2:</h1>
  <ul>
${links.map((link) => `    <li><a href="${link}">${link}</a></li>`).join("\n")}
  </ul>
</body>
</html>`;
};
