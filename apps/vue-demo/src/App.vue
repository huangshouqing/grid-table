<template>
  <div class="app">
    <h1>Grid Table Vue Demo</h1>
    <div class="grid-container">
      <GridTable />
    </div>
  </div>
</template>

<script>
import GridTable from './components/GridTable.vue'

export default {
  name: 'App',
  components: {
    GridTable
  }
}
</script>

<style>
.app {
  font-family: Arial, sans-serif;
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

h1 {
  color: #333;
  text-align: center;
  margin-bottom: 30px;
}

.grid-container {
  height: 600px;
  border: 1px solid #ddd;
  border-radius: 4px;
  overflow: hidden;
}
</style> 