<script setup lang="ts">
import { ref } from "vue";

const count = ref(0);
</script>

<template>
  <div>Hello Vue!</div>
  <button @click="count++">Count: {{ count }}</button>
</template>

<style scoped>
div {
  font-family: Arial, sans-serif;
  font-size: 20px;
  margin-bottom: 10px;
}

button {
  background-color: #4caf50;
  color: white;
  border: none;
  padding: 10px 20px;
  font-size: 16px;
  cursor: pointer;
  border-radius: 5px;
}

button:hover {
  background-color: #45a049;
}
</style>
