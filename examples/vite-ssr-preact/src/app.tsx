import { useState } from "preact/hooks";

export function App() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount((c) => c + 1)}>Count is {count}</button>;
}
