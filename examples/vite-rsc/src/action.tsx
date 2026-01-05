'use server'

let serverCounter = 0

export async function getServerCounter() {
  return serverCounter
}

export async function updateServerCounter(change: number) {
  serverCounter += change
}
