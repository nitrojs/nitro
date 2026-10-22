import url from "./1.txt?url";

fetch(url)
  .then((res) => res.text())
  .then((text) => (document.body.dataset.text = text));
