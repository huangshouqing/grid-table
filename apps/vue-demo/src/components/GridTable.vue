<template>
  <div class="grid-table-wrapper">
    <div class="grid-controls">
      <div class="control-group">
        <button class="add-button" @click="addNewRow('top')">顶部新增行</button>
        <button class="add-button" @click="addNewRow('bottom')">底部新增行</button>
      </div>
      <div class="control-group">
        <label>
          <input type="checkbox" v-model="autoScrollToNewRow" />
          自动滚动到新增行
        </label>
      </div>
    </div>
    <div ref="gridContainer" class="grid-table-container"></div>
  </div>
</template>

<script>
import { onMounted, onUnmounted, ref } from 'vue'
import { Grid } from '@grid-table/core'
import { StatusCellComponent } from './CustomComponents.js'
import { vueAdapter, ratingComponentDefinition, buttonComponentDefinition, deleteButtonComponentDefinition } from './AdapterConfig.js'

export default {
  name: 'GridTable',
  setup() {
    const gridContainer = ref(null)
    let gridInstance = null
    let lastId = 17 // 初始数据最后一个ID是17
    const autoScrollToNewRow = ref(true) // 是否自动滚动到新增行

    // 生成新行数据
    const generateNewRowData = () => {
      lastId++
      return {
        id: lastId,
        name: `产品 ${String.fromCharCode(65 + (lastId % 26))}${lastId}`, // 生成类似 A18, B19 的命名
        price: Math.floor(Math.random() * 300) + 50, // 50-350之间的随机价格
        status: ['active', 'inactive', 'pending'][Math.floor(Math.random() * 3)], // 随机状态
        quantity: Math.floor(Math.random() * 70) + 5, // 5-75之间的随机数量
        rating: Math.floor(Math.random() * 5) + 1, // 1-5之间的随机评分
      }
    }

    // 添加新行
    const addNewRow = (position = 'bottom') => {
      if (gridInstance) {
        const newRow = generateNewRowData()
        console.log(`添加新行: ${JSON.stringify(newRow)}, 位置: ${position}, 自动滚动: ${autoScrollToNewRow.value}`);

        // 使用Grid API的autoScroll参数
        gridInstance.addRow(newRow, position, autoScrollToNewRow.value);
      }
    }

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
            field: "checkbox",
            headerName: "",
            width: 50,
            checkboxSelection: true,
            frozen: true,
          },
          {
            field: 'id',
            headerName: 'ID',
            width: 100,
            rowDrag: true
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
              props: {}
            }
          },
          {
            field: 'details',
            headerName: '详情',
            width: 100,
            cellComponent: {
              type: 'button-cell',
              props: {
                // 此处可以传入参数，给组件使用
                text: '详情'
              }
            }
          },
          {
            field: 'delete',
            headerName: '操作',
            width: 100,
            cellComponent: {
              type: 'delete-button',
              props: {}
            }
          }
        ],
        rowSelection: "multiple",
        enableRowDrag: true, // 启用行拖拽
        minHeight: 500,
        maxHeight: 500,
        rowStyle: {
          height: 50
        },
        onCellValueChanged: (event) => {
          console.log('单元格值更新:', event);
        }
      }

      gridInstance = new Grid(options)

      const componentManager = gridInstance.getComponentManager()

      vueAdapter.setDefaultPropsHandler((params) => {
        return {
          ...params,
          api: gridInstance
        };
      });

      componentManager.registerComponent('status-cell', {
        view: StatusCellComponent,
        edit: StatusCellComponent
      })

      componentManager.registerComponent('rating', ratingComponentDefinition)

      componentManager.registerComponent('button-cell', buttonComponentDefinition)

      // 注册删除按钮组件
      componentManager.registerComponent('delete-button', deleteButtonComponentDefinition)

      gridInstance.render(gridContainer.value)

      console.log('表格实例已创建并渲染', {
        gridInstance,
        hasUpdateRowData: typeof gridInstance.updateRowData === 'function',
        hasRefreshRow: typeof gridInstance.refreshRow === 'function',
        hasRefreshCell: typeof gridInstance.refreshCell === 'function'
      });
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
      gridContainer,
      addNewRow,
      autoScrollToNewRow
    }
  }
}
</script>

<style scoped>
.grid-table-wrapper {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
}

.grid-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  padding: 8px 12px;
  background-color: #f5f5f5;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.control-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.add-button {
  padding: 6px 12px;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;
}

.add-button:hover {
  background-color: #45a049;
}

.add-button:active {
  transform: translateY(1px);
}

label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: #333;
  cursor: pointer;
}

input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: #4CAF50;
}
.grid-table-container {
  height: 400px !important;
}
</style>