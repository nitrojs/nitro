<script setup lang="ts">
import { ref } from "vue";

const count = ref(0);

function increment() {
  count.value++;
}
</script>

<template>
  <main>
    <div class="hero">
      <h1>Vue Router Custom Framework</h1>
      <p class="subtitle">A simple demo app with Vite</p>
    </div>

    <div class="card counter-card">
      <p>Count: {{ count }}</p>
      <button @click="increment">Increment</button>
    </div>
  </main>
</template>

<style scoped>
.hero {
  text-align: center;
  margin-bottom: 2rem;
}

.hero h1 {
  color: rgb(100, 108, 255);
}

.counter-card {
  text-align: center;
}

.counter-card h2 {
  color: #646cff;
  margin-bottom: 1rem;
}

.counter-card p {
  font-size: 1.5rem;
  font-weight: bold;
  margin: 1rem 0;
}
</style>
