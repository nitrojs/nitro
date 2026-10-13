<script setup lang="ts">
import { RouterLink, RouterView } from "vue-router";
import "./styles.css";
</script>

<template>
  <nav>
    <ul>
      <li>
        <RouterLink to="/" exact-active-class="active">Home</RouterLink>
      </li>
      <li>
        <RouterLink to="/about" active-class="active">About</RouterLink>
      </li>
    </ul>
  </nav>
  <RouterView />
</template>

<style scoped>
nav {
  background: white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  padding: 1rem;
}

nav ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  gap: 2rem;
  max-width: 800px;
  margin: 0 auto;
}

nav a {
  color: #666;
  text-decoration: none;
}

nav a:hover {
  color: #333;
}

nav a.active {
  color: #646cff;
}
</style>
