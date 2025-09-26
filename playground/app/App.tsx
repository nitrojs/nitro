import { useEffect, useState } from "react";
import logo from "./assets/nitro.png";

export default function App() {
  const [count, setCount] = useState(0);

  return (
    <main
      className="app"
      role="main"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        flexDirection: "column",
        textAlign: "center",
        gap: "1rem",
        backgroundColor: "#071028",
        color: "#e6eef8",
        WebkitFontSmoothing: "antialiased",
        MozOsxFontSmoothing: "grayscale",
        fontFamily:
          "'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif",
        fontSize: "16px",
        lineHeight: 1.6,
        fontWeight: 400,
        letterSpacing: "0.01em",
      }}
    >
      <img
        src={logo}
        alt="Nitro Logo"
        width={200}
        height={200}
        loading="lazy"
      />
      <h1>Welcome to Nitro</h1>

      <section>
        <TestEndpoint
          label="server.ts"
          url="/server"
          test={(text) => text === "Response from server.ts"}
        />
        <TestEndpoint
          label="routes/route.ts"
          url="/route"
          test={(text) => text === "Response from routes/route.ts"}
        />
      </section>

      <section>
        <p>
          Count: <strong>{count}</strong>
        </p>
        <p>
          <button type="button" onClick={() => setCount((c) => c + 1)}>
            Increment
          </button>
        </p>
      </section>
    </main>
  );
}

// ---- Test Components ----

function TestEndpoint({
  label,
  url,
  test,
}: {
  label: string;
  url: string;
  test: (text: string) => boolean;
}) {
  const [status, setStatus] = useState<boolean | undefined>(undefined);
  useEffect(() => {
    fetch(url, { headers: { accept: "text/html" } })
      .then((r) => r.text())
      .then((text) => {
        console.log(text);
        return test(text);
      })
      .then(setStatus)
      .catch(() => setStatus(false));
  }, [url, test, setStatus]);
  return (
    <p style={{ display: "inline-block" }}>
      <TestStatus status={status} />
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        style={{ color: "lightblue" }}
      >
        {label}
      </a>
    </p>
  );
}

function TestStatus({ status }: { status: boolean | undefined }) {
  if (status === undefined) {
    return <span style={{ color: "gray", padding: "0 0.5rem" }}>...</span>;
  }
  if (status === true) {
    return <span style={{ color: "lightgreen", padding: "0 0.5rem" }}>✓</span>;
  }
  return <span style={{ color: "red", padding: "0 0.5rem" }}>✗</span>;
}
