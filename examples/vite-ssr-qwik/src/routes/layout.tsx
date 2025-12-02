import { component$, Slot } from "@qwik.dev/core";

export default component$(() => {
  return (
    <>
      <header>Layout Header</header>
      <main>
        <Slot />
      </main>
      <footer>Layout Footer</footer>
    </>
  );
});
