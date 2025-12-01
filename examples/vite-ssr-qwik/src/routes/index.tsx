import { component$, useSignal } from "@qwik.dev/core";
import { Form, routeAction$, routeLoader$, server$ } from "@qwik.dev/router";
import type { DocumentHead } from "@qwik.dev/router";

export const useLoader = routeLoader$(() => {
  return "data from routeLoader$";
});

export const useAction = routeAction$(async (data) => {
  return {
    success: true,
    firstName: data.firstName.toString(),
    lastName: data.lastName.toString(),
  };
});

const serverFunction = server$(() => {
  console.log("server function");
  return "data from server$, look at the server console!";
});

export default component$(() => {
  const action = useAction();
  const loaderData = useLoader();
  const counterSig = useSignal(0);

  return (
    <div>
      <h1>Hello, Qwik!</h1>
      <h2>{loaderData.value}</h2>
      <button onClick$={() => (counterSig.value += 1)}>
        Count: {counterSig.value}
      </button>
      <br></br>
      <br></br>
      <button
        onClick$={async () => {
          const res = await serverFunction();
          alert(res);
        }}
      >
        server$ function
      </button>
      <Form class="pt-2" action={action}>
        <input name="firstName" />
        <input name="lastName" />
        <button type="submit">Add user</button>
      </Form>
      {action.value?.success && (
        <p class="pt-2">
          User {action.value.firstName} {action.value.lastName} added
          successfully
        </p>
      )}
    </div>
  );
});

export const head: DocumentHead = { title: "Vite + Nitro + Qwik", meta: [] };
