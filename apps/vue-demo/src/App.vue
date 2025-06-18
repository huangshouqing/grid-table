<template>
  <div class="app">
    <h1>Grid Table Vue Demo</h1>
    <GridTable />
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

</style>