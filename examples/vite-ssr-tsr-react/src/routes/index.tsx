import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  loader: async () => {
    const r = await fetch("/api/hello");
    return r.json();
  },
  component: Index,
});

function Index() {
  const r = Route.useLoaderData();

  return (
    <div className="p-2">
      <h3>{JSON.stringify(r)}</h3>
    </div>
  );
}
