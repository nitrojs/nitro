<script setup lang="ts">
import { ref } from "vue";

const count = ref(0);
</script>

<template>
  <div>Hello Vue!</div>
  <button @click="count++">Count: {{ count }}</button>
</template>
