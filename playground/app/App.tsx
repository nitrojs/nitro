import { useState } from "react";
import logo from "../assets/nitro.png";

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
