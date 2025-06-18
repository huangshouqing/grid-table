<template>
  <div class="grid-table-wrapper">
    <div ref="gridContainer" class="grid-table-container"></div>
  </div>
</template>

<script>
import { onMounted, onUnmounted, ref } from 'vue'
import { Grid } from '@grid-table/core'
import { StatusCellComponent } from './CustomComponents.js'
import { ratingComponentDefinition, buttonComponentDefinition } from './AdapterConfig.js'

export default {
  name: 'GridTable',
  setup() {
    const gridContainer = ref(null)
    let gridInstance = null

    const createGrid = () => {
      const data = [
        { id: 1, name: '产品 A', price: 100, status: 'active', quantity: 50, rating: 4 },
        { id: 2, name: '产品 B', price: 150, status: 'inactive', quantity: 30, rating: 2 },
        { id: 3, name: '产品 C', price: 200, status: 'active', quantity: 20, rating: 5 },
        { id: 4, name: '产品 D', price: 80, status: 'pending', quantity: 65, rating: 3 },
        { id: 5, name: '产品 E', price: 300, status: 'active', quantity: 10, rating: 4 },
        { id: 6, name: '产品 F', price: 250, status: 'inactive', quantity: 5, rating: 1 },
        { id: 7, name: '产品 G', price: 120, status: 'pending', quantity: 25, rating: 3 },
        { id: 8, name: '产品 H', price: 180, status: 'active', quantity: 40, rating: 5 },
        { id: 9, name: '产品 I', price: 90, status: 'inactive', quantity: 60, rating: 2 },
        { id: 10, name: '产品 J', price: 350, status: 'active', quantity: 15, rating: 4 },
        { id: 11, name: '产品 K', price: 350, status: 'active', quantity: 15, rating: 5 },
        { id: 12, name: '产品 L', price: 350, status: 'active', quantity: 15, rating: 3 },
        { id: 13, name: '产品 M', price: 350, status: 'active', quantity: 15, rating: 4 },
        { id: 14, name: '产品 N', price: 350, status: 'active', quantity: 15, rating: 2 },
        { id: 15, name: '产品 O', price: 350, status: 'active', quantity: 15, rating: 5 },
        { id: 16, name: '产品 P', price: 350, status: 'active', quantity: 15, rating: 3 },
        { id: 17, name: '产品 Q', price: 350, status: 'active', quantity: 15, rating: 4 },
      ]

      const options = {
        container: gridContainer.value,
        rowData: data,
        columns: [
          {
            field: 'id',
            headerName: 'ID',
            width: 100
          },
          {
            field: 'name',
            headerName: '产品名称',
            width: 200,
            sortable: true,
            editable: true
          },
          {
            field: 'price',
            headerName: '价格',
            width: 150,
            sortable: true,
            editable: true,
            fillable: true,
            valueFormatter: (params) => `¥${params.value}`
          },
          {
            field: 'quantity',
            headerName: '数量',
            width: 150,
            sortable: true,
            editable: true,
            fillable: true
          },
          {
            field: 'status',
            headerName: '状态',
            width: 150,
            sortable: true,
            cellComponent: {
              type: 'status-cell',
              props: {}
            }
          },
          {
            field: 'rating',
            headerName: '评分',
            width: 150,
            sortable: true,
            editable: true,
            cellComponent: {
              type: 'rating',
              props: {

              }
            }
          },
          {
            field: 'actions',
            headerName: '操作',
            width: 150,
            cellComponent: {
              type: 'button-cell',
              props: {
                text: '查看详情'
              }
            }
          }
        ],
        minHeight: 500,
        maxHeight: 500,
        rowStyle: {
          height: 50
        },
        api: {
          updateRowData: (rowIndex, newData) => {
            if (rowIndex >= 0 && rowIndex < data.length) {
              const id = data[rowIndex].id;

              data[rowIndex] = {
                ...newData,
                id
              };

              if (gridInstance && gridInstance.refreshRow) {
                gridInstance.refreshRow(rowIndex);
              }

              return true;
            }
            return false;
          }
        }
      }

      gridInstance = new Grid(options)
      const componentManager = gridInstance.getComponentManager()

      componentManager.registerComponent('status-cell', {
        view: StatusCellComponent,
        edit: StatusCellComponent
      })

      componentManager.registerComponent('rating', ratingComponentDefinition)

      componentManager.registerComponent('button-cell', buttonComponentDefinition)

      gridInstance.render(gridContainer.value)
    }

    onMounted(() => {
      setTimeout(createGrid, 0)
    })

    onUnmounted(() => {
      if (gridInstance) {
        gridInstance.destroy()
      }
    })

    return {
      gridContainer
    }
  }
}
</script>

<style>
.grid-table-wrapper {
  height: 100%;
  width: 100%;
}

.grid-table-container {
  height: 100%;
  width: 100%;
}
</style>