import React, { useState } from "react";

export default () => {
  const [count, setCount] = useState(0);

  return (
    <div>
      <h1>Hello, React!</h1>
      <button onClick={() => setCount(count + 1)}>Count: {count}</button>
    </div>
  );
};
