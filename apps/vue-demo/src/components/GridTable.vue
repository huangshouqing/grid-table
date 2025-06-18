<template>
  <div class="grid-table-wrapper">
    <div class="grid-controls">
      <div class="control-group">
        <button class="add-button" @click="addNewRow('top')">顶部新增行</button>
        <button class="add-button" @click="addNewRow('bottom')">底部新增行</button>
        <button class="add-button" @click="clearData">清空数据</button>
        <button class="add-button" @click="restoreData">恢复数据</button>
      </div>
      <div class="control-group">
        <label>
          <input type="checkbox" v-model="autoScrollToNewRow" />
          自动滚动到新增行
        </label>
        <select v-model="heightMode" @change="updateHeightMode">
          <option value="auto">自动高度</option>
          <option value="min">最小高度</option>
          <option value="max">最大高度</option>
          <option value="fixed">固定高度</option>
        </select>
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
  // 定义组件可以向父组件发送的事件
  emits: ['data-changed', 'selection-changed', 'grid-ready'],
  setup(props, { emit }) {
    const gridContainer = ref(null)
    let gridInstance = null
    let lastId = 17 // 初始数据最后一个ID是17
    const autoScrollToNewRow = ref(true) // 是否自动滚动到新增行
    const heightMode = ref('auto') // 高度模式：auto, min, max, fixed

    // 使用响应式数据存储表格数据，便于双向同步
    const gridData = ref([]);
    let originalData = null // 保存原始数据用于恢复

    // 创建自定义无数据提示
    const createNoDataContent = () => {
      const container = document.createElement('div');
      container.className = 'custom-no-data';

      const icon = document.createElement('div');
      icon.className = 'no-data-icon';
      icon.innerHTML = `
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M24 4C12.95 4 4 12.95 4 24C4 35.05 12.95 44 24 44C35.05 44 44 35.05 44 24C44 12.95 35.05 4 24 4ZM26 34H22V30H26V34ZM26 26H22V14H26V26Z" fill="#CCCCCC"/>
        </svg>
      `;

      const text = document.createElement('div');
      text.className = 'no-data-text';
      text.textContent = '暂无数据，请添加行数据';

      container.appendChild(icon);
      container.appendChild(text);

      return container;
    };

    // 设置事件总线，提供给外部组件使用
    const setupEventBusListeners = (gridInstance) => {
      const eventBus = gridInstance.getEventBus();

      // 监听所有数据变更事件，便于调试和扩展
      eventBus.subscribe('gridDataChanged', (event) => {
        console.log('【事件总线】数据变更:', event);

        // 根据事件类型执行不同操作
        switch (event.type) {
          case 'cellValueChanged':
            // 单元格值变更 - 更新响应式数据
            const rowIndex = gridData.value.findIndex(row => row.id === event.nodeId);
            if (rowIndex >= 0) {
              gridData.value[rowIndex] = { ...gridData.value[rowIndex] };
            }
            break;

          case 'rowAdded':
            // 行添加 - 这里可以执行特定操作，如显示通知
            console.log('【事件总线】新行已添加:', event.data);
            break;

          case 'rowRemoved':
            // 行删除 - 可以执行清理操作
            console.log('【事件总线】行已删除:', event.data);
            break;

          case 'rowMoved':
            // 行移动 - 可以更新依赖于行顺序的数据
            console.log('【事件总线】行已移动:', event.fromIndex, '->', event.toIndex);
            break;

          case 'dataLoaded':
            // 数据加载 - 可以执行初始化操作
            console.log('【事件总线】数据已加载:', event.data.length, '行');
            break;
        }

        // 通知父组件数据已变更（跨组件通信示例）
        emitGridEvent('data-changed', event);
      });

      // 监听选择变更事件
      eventBus.subscribe('gridSelectionChanged', (event) => {
        console.log('【事件总线】选择变更:', event);

        // 通知父组件选择已变更（跨组件通信示例）
        emitGridEvent('selection-changed', {
          type: event.type,
          count: event.selectedNodes.length,
          selectedIds: event.selectedNodes.map(node => node.id)
        });
      });

      return eventBus;
    };

    // 向父组件发送事件（跨组件通信）
    const emitGridEvent = (eventName, data) => {
      console.log(`【跨组件通信】发送事件: ${eventName}`, data);
      // 使用Vue的emit方法向父组件发送事件
      emit(eventName, data);
    };

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
        // 使用Grid API的autoScroll参数
        gridInstance.addRow(newRow, position, autoScrollToNewRow.value);
      }
    }

    // 清空数据
    const clearData = () => {
      if (gridInstance) {
        // 保存当前数据以便恢复
        if (!originalData && gridInstance.getDisplayedRowCount() > 0) {
          originalData = gridInstance.getSelectedRows();
        }
        // 设置空数据
        gridInstance.setRowData([]);
      }
    }

    // 恢复数据
    const restoreData = () => {
      if (gridInstance && originalData) {
        gridInstance.setRowData(originalData);
      } else {
        // 如果没有保存的数据，创建一些示例数据
        createGrid();
      }
    }

    // 更新高度模式
    const updateHeightMode = () => {
      if (!gridInstance) return;
      switch (heightMode.value) {
        case 'auto':
          gridInstance.setMinHeight('auto');
          gridInstance.setMaxHeight(null); // 不限制最大高度
          break;
        case 'min':
          gridInstance.setMinHeight(300);
          gridInstance.setMaxHeight(null);
          break;
        case 'max':
          gridInstance.setMinHeight('auto');
          gridInstance.setMaxHeight(400);
          break;
        case 'fixed':
          gridInstance.setMinHeight(400);
          gridInstance.setMaxHeight(400);
          break;
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
      // 设置响应式数据引用
      gridData.value = [...data];
      // 保存原始数据以便恢复
      originalData = [...data];
      const options = {
        container: gridContainer.value,
        rowData: gridData.value, // 使用响应式数据
        columns: [
          {
            field: "checkbox",
            headerName: "",
            width: 50,
            checkboxSelection: true,
            frozen: true,
            pinned: 'left'
          },
          {
            field: 'id',
            headerName: 'ID',
            width: 50,
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
            pinned: 'right',
            cellComponent: {
              type: 'delete-button',
              props: {}
            }
          }
        ],
        rowSelection: "multiple",
        enableRowDrag: true, // 启用行拖拽
        minHeight: '200px', // 默认自动高度
        maxHeight: '300px', // 默认不限制最大高度
        noDataContent: createNoDataContent(), // 自定义无数据内容
        // 单元格值变更事件
        onCellValueChanged: (event) => {
          // 手动更新 Vue 响应式数据
          const rowIndex = gridData.value.findIndex(row => row.id === event.node.id);
          if (rowIndex !== -1) {
            // 创建新的引用触发响应式更新
            gridData.value[rowIndex] = { ...gridData.value[rowIndex], [event.colId]: event.newValue };
          }
        },
        // 行点击事件
        onRowClicked: (event) => {
          console.log('点击行:', event.data);
        },
        // 单元格点击事件
        onCellClicked: (event) => {
          console.log('点击单元格:', event.value);
        },
        // 选择变更事件
        onSelectionChanged: (event) => {
          console.log('已选择:', event.selectedNodes.length, '行');
        },
        // 排序变更事件
        onSortChanged: (event) => {
          console.log('排序变更:', event.sortModel);
        },
        // 行拖拽结束事件
        onRowDragEnd: (event) => {
          console.log('行拖拽结束:', event);
        },
        // 数据加载完成 - 处理初始加载和重新加载
        onGridReady: (params) => {
          console.log('数据加载完成:', params);
        }
      }
      gridInstance = new Grid(options)
      const componentManager = gridInstance.getComponentManager()

      // 设置事件总线监听器
      const eventBus = setupEventBusListeners(gridInstance);

      // 发送grid-ready事件给父组件
      emit('grid-ready', {
        gridApi: gridInstance,
        eventBus: eventBus
      });

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
      // 应用初始的高度模式
      updateHeightMode();

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
      clearData,
      restoreData,
      autoScrollToNewRow,
      heightMode,
      updateHeightMode
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

select {
  padding: 6px 10px;
  border-radius: 4px;
  border: 1px solid #ddd;
  font-size: 14px;
  cursor: pointer;
}

.grid-table-container {
  width: 100%;
  flex: 1;
}

/* 自定义无数据样式 */
:deep(.custom-no-data) {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 40px;
}

:deep(.no-data-icon) {
  opacity: 0.6;
}

:deep(.no-data-text) {
  font-size: 16px;
  color: #999;
}
</style>