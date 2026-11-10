const button = document.querySelector<HTMLButtonElement>("#counter")!;

let count = 0;
button.disabled = false;
button.addEventListener("click", () => {
  button.textContent = `Count: ${++count}`;
});
