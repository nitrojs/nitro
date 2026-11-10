import "./client.css";

document.addEventListener("click", async () => {
  const { page } = await import("./page.ts");
  document.body.textContent = page;
});
