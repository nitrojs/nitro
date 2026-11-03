import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState } from "react";

const getServerTime = createServerFn({ method: "GET" }).handler(() => {
  return new Date().toISOString();
});

export const Route = createFileRoute("/")({
  loader: () => getServerTime(),
  component: Home,
});

function Home() {
  const [time, setTime] = useState<string>(Route.useLoaderData());
  return (
    <div className="p-2">
      <h3>Welcome Home!</h3>
      <p>
        Server time: <span id="server-time">{time}</span>
      </p>
      <button onClick={async () => setTime(await getServerTime())}>Refresh</button>
      <p>
        <a href="/api/test">/api/test</a>
      </p>
    </div>
  );
}
