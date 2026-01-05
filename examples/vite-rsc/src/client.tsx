'use client'

import React from 'react'

export function ClientCounter() {
  const [count, setCount] = React.useState(0)

  return (
    <button onClick={() => setCount((count) => count + 1)}>
      Client Counter: {count}
    </button>
  )
}
