<template>
  <div class="grid-table-wrapper">
    <div ref="gridContainer" class="grid-table-container"></div>
  </div>
</template>

<script>
import { onMounted, onUnmounted, ref } from 'vue'
import { Grid } from '@grid-table/core'
import { StatusCellComponent, ButtonCellComponent } from './CustomComponents.js'

export default {
  name: 'GridTable',
  setup() {
    const gridContainer = ref(null)
    let gridInstance = null

    const createGrid = () => {
      const data = [
        { id: 1, name: '产品 A', price: 100, status: 'active', quantity: 50 },
        { id: 2, name: '产品 B', price: 150, status: 'inactive', quantity: 30 },
        { id: 3, name: '产品 C', price: 200, status: 'active', quantity: 20 },
        { id: 4, name: '产品 D', price: 80, status: 'pending', quantity: 65 },
        { id: 5, name: '产品 E', price: 300, status: 'active', quantity: 10 },
        { id: 6, name: '产品 F', price: 250, status: 'inactive', quantity: 5 },
        { id: 7, name: '产品 G', price: 120, status: 'pending', quantity: 25 },
        { id: 8, name: '产品 H', price: 180, status: 'active', quantity: 40 },
        { id: 9, name: '产品 I', price: 90, status: 'inactive', quantity: 60 },
        { id: 10, name: '产品 J', price: 350, status: 'active', quantity: 15 },
        { id: 11, name: '产品 K', price: 350, status: 'active', quantity: 15 },
        { id: 12, name: '产品 L', price: 350, status: 'active', quantity: 15 },
        { id: 13, name: '产品 M', price: 350, status: 'active', quantity: 15 },
        { id: 14, name: '产品 N', price: 350, status: 'active', quantity: 15 },
        { id: 15, name: '产品 O', price: 350, status: 'active', quantity: 15 },
        { id: 16, name: '产品 P', price: 350, status: 'active', quantity: 15 },
        { id: 17, name: '产品 Q', price: 350, status: 'active', quantity: 15 },
      ]

      const options = {
        // 待实现功能，这里的 container 没有实际用途
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
            fillable: true, // 启用批量填充
            valueFormatter: (params) => `¥${params.value}`
          },
          {
            field: 'quantity',
            headerName: '数量',
            width: 150,
            sortable: true,
            editable: true,
            fillable: true // 启用批量填充
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
        // 待实现功能
        minHeight: 500,
        maxHeight: 500,
        rowStyle: {
          height: 50
        }
      }
      gridInstance = new Grid(options)
      const componentManager = gridInstance.getComponentManager()
      // 这边组件注册，我不想显式的说明 view edit，帮我重新设计组件注册机制，但是在类组件中需要给定 view 和 edit 俩种
      componentManager.registerComponent('status-cell', {
        view: StatusCellComponent,
        edit: StatusCellComponent
      })
      componentManager.registerComponent('button-cell', {
        view: ButtonCellComponent,
        edit: ButtonCellComponent
      })
      // 渲染表格不需要手动再 render，但是需要保留这个 render兼容老的写法
      gridInstance.render(gridContainer.value)
    }

    onMounted(() => {
      setTimeout(createGrid, 0) // 确保DOM已渲染
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