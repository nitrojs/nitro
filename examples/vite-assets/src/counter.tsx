import { useState } from "preact/hooks";

export function Counter() {
  const [count, setCount] = useState(0);
  return (
    <button onClick={() => setCount((c) => c + 1)}>Count is {count}</button>
  );
}
