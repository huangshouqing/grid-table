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
      </div>
    </div>
    <div class="grid-container-wrapper">
      <h3>普通表格</h3>
      <div ref="gridContainer" id="1"></div>
    </div>

    <div class="grid-container-wrapper">
      <h3>树形结构表格</h3>
      <div ref="treeGridContainer" id="2"></div>
    </div>

    <div class="formula-wrapper">
      <h3>公式演示</h3>
      <div class="formula-demo">
        <div class="formula-row">
          <div class="formula-item">
            <label>价格:</label>
            <input type="number" v-model.number="formulaData.price" @input="calculateFormula" />
          </div>
          <div class="formula-item">
            <label>数量:</label>
            <input type="number" v-model.number="formulaData.quantity" @input="calculateFormula" />
          </div>
          <div class="formula-item">
            <label>折扣率:</label>
            <select v-model="formulaData.discountRate" @change="calculateFormula">
              <option :value="1">无折扣</option>
              <option :value="0.95">95折</option>
              <option :value="0.9">9折</option>
              <option :value="0.8">8折</option>
              <option :value="0.7">7折</option>
            </select>
          </div>
        </div>
        <div class="formula-result">
          <div class="formula-expression">
            <strong>总价计算公式:</strong> 价格 × 数量 = {{ formulaData.price }} × {{ formulaData.quantity }} = {{
              formulaData.total }}
          </div>
          <div class="formula-expression">
            <strong>最终价格计算公式:</strong> 总价 × 折扣率 = {{ formulaData.total }} × {{ (formulaData.discountRate *
              100).toFixed(0) }}% = {{ formulaData.finalPrice }}
          </div>
        </div>
      </div>
    </div>
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
    const treeGridContainer = ref(null)
    let gridInstance = null
    let treeGridInstance = null
    let lastId = 17 // 初始数据最后一个ID是17
    const autoScrollToNewRow = ref(true) // 是否自动滚动到新增行

    // 使用响应式数据存储表格数据，便于双向同步
    const gridData = ref([]);
    // 树形表格数据，独立存储
    const treeGridData = ref([]);

    // 公式演示数据
    const formulaData = ref({
      price: 100,
      quantity: 10,
      discountRate: 0.9,
      total: 1000,
      finalPrice: 900
    });

    // 计算公式演示
    const calculateFormula = () => {
      formulaData.value.total = formulaData.value.price * formulaData.value.quantity;
      formulaData.value.finalPrice = formulaData.value.total * formulaData.value.discountRate;
    };

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
        rowData: gridData.value,
        columns: [
          {
            field: "checkbox",
            headerName: "",
            width: 50,
            checkboxSelection: true,
            frozen: true,
            pinned: 'left',
          },
          {
            field: '',
            headerName: 'ID',
            width: 50,
            rowDrag: true,
          },
          {
            field: 'id',
            headerName: 'ID',
            width: 50,
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
            field: 'total',
            headerName: '总价',
            width: 150,
            sortable: true,
            editable: true,
            fillable: true,
            formula: 'price * quantity'
          },
          {
            field: 'tax',
            headerName: '税',
            width: 150,
            sortable: true,
            editable: true,
            fillable: true,
          },
          {
            field: 'taxRate',
            headerName: '税率',
            width: 150,
            sortable: true,
            editable: true,
            fillable: true,
          },
          {
            field: 'taxAmount',
            headerName: '税额',
            width: 150,
            sortable: true,
            editable: true,
            fillable: true,
            formula: 'tax * taxRate'
          },
          {
            field: 'taxedAmount',
            headerName: '税后金额',
            width: 150,
            sortable: true,
            editable: true,
            fillable: true,
            formula: 'total - taxAmount'
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
        enableRowDrag: true,
        minHeight: '300px',
        maxHeight: '300px',
        noDataContent: createNoDataContent(),
        onCellValueChanged: (event) => {
          const rowIndex = gridData.value.findIndex(row => row.id === event.node.id);
          if (rowIndex !== -1) {
            gridData.value[rowIndex] = { ...gridData.value[rowIndex], [event.colId]: event.newValue };
          }
        },
        onRowClicked: (event) => {
          console.log('点击行:', event.data);
        },
        onCellClicked: (event) => {
          console.log('点击单元格:', event.value);
        },
        onSelectionChanged: (event) => {
          console.log('已选择:', event.selectedNodes.length, '行');
        },
        onSortChanged: (event) => {
          console.log('排序变更:', event.sortModel);
        },
        onRowDragEnd: (event) => {
          console.log('行拖拽结束:', event);
        },
        onGridReady: (params) => {
          console.log('数据加载完成:', params);
        }
      }

      if (gridInstance) {
        gridInstance.destroy();
      }

      gridInstance = new Grid(options);
      const componentManager = gridInstance.getComponentManager();

      const eventBus = setupEventBusListeners(gridInstance);
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
      });
      componentManager.registerComponent('rating', ratingComponentDefinition);
      componentManager.registerComponent('button-cell', buttonComponentDefinition);
      componentManager.registerComponent('delete-button', deleteButtonComponentDefinition);

      gridInstance.render(gridContainer.value);
    }

    const createTreeGrid = () => {
      const treeData = [
        {
          id: "1",
          name: "电子产品",
          expanded: true,
          children: [
            {
              id: "1-1",
              name: "手机",
              expanded: true,
              children: [
                { id: "1-1-1", name: "iPhone 14", price: 5999, stock: 120 },
                { id: "1-1-2", name: "Samsung S23", price: 6299, stock: 85 },
                { id: "1-1-3", name: "Huawei P50", price: 4999, stock: 60 },
              ],
            },
            {
              id: "1-2",
              name: "电脑",
              expanded: false,
              children: [
                { id: "1-2-1", name: "MacBook Pro", price: 13999, stock: 45 },
                { id: "1-2-2", name: "Dell XPS", price: 9999, stock: 30 },
                { id: "1-2-3", name: "ThinkPad X1", price: 11999, stock: 25 },
              ],
            },
          ],
        },
        {
          id: "2",
          name: "家用电器",
          expanded: false,
          children: [
            {
              id: "2-1",
              name: "厨房电器",
              children: [
                { id: "2-1-1", name: "微波炉", price: 899, stock: 150 },
                { id: "2-1-2", name: "电饭煲", price: 499, stock: 200 },
              ],
            },
          ],
        },
      ];

      // 设置树形表格的数据
      treeGridData.value = [...treeData];

      const options = {
        container: treeGridContainer.value,
        rowData: treeGridData.value,
        columns: [
          {
            field: "name",
            headerName: "产品分类",
            width: 300,
            cellRenderer: "treeCell",
            treeColumn: true,
          },
          {
            field: "price",
            headerName: "价格",
            editable: true,
            width: 150,
            valueFormatter: (params) => {
              return params.value ? `¥${params.value.toLocaleString()}` : "";
            },
          },
          {
            field: "stock",
            headerName: "库存",
            width: 120,
            editable: true,
            levelFormulas: [
              { level: 0, formula: "SUM(children, 'stock')" },
              { level: 1, formula: "SUM(children, 'stock')" },
            ]
          },
        ],
        treeData: true,
        rowSelection: "multiple",
        minHeight: '300px',
        maxHeight: '300px',
        noDataContent: createNoDataContent(),
        onCellValueChanged: (event) => {
          console.log('树形表格数据变更:', event);
        },
        onRowClicked: (event) => {
          console.log('点击行:', event.data);
        },
        onCellClicked: (event) => {
          console.log('点击单元格:', event.value);
        },
        onSelectionChanged: (event) => {
          console.log('已选择:', event.selectedNodes.length, '行');
        },
        onSortChanged: (event) => {
          console.log('排序变更:', event.sortModel);
        },
        onRowDragEnd: (event) => {
          console.log('行拖拽结束:', event);
        },
        onGridReady: (params) => {
          console.log('树形表格数据加载完成:', params);
        }
      };

      if (treeGridInstance) {
        treeGridInstance.destroy();
      }

      treeGridInstance = new Grid(options);
      treeGridInstance.render(treeGridContainer.value);
    }

    onMounted(() => {
      // 延迟执行表格初始化，确保DOM已渲染
      setTimeout(createGrid, 0);
      // 进一步延迟树形表格渲染，避免与普通表格渲染冲突
      setTimeout(createTreeGrid, 300);
    })

    onUnmounted(() => {
      if (gridInstance) {
        gridInstance.destroy();
      }
      if (treeGridInstance) {
        treeGridInstance.destroy();
      }
    })

    return {
      gridContainer,
      treeGridContainer,
      addNewRow,
      clearData,
      restoreData,
      autoScrollToNewRow,
      formulaData,
      calculateFormula
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

.grid-container-wrapper {
  margin-bottom: 30px;
}

.grid-container-wrapper h3 {
  margin: 20px 0 10px;
  color: #333;
  font-size: 18px;
  border-left: 4px solid #4CAF50;
  padding-left: 10px;
}

.grid-container {
  height: 350px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
}

.formula-wrapper h3 {
  margin: 20px 0 10px;
  color: #333;
  font-size: 18px;
  border-left: 4px solid #4CAF50;
  padding-left: 10px;
}

/* 公式演示区域 */
.formula-demo {
  margin-bottom: 20px;
  padding: 15px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  background-color: #f9f9f9;
}

.formula-row {
  display: flex;
  gap: 20px;
  margin-bottom: 15px;
}

.formula-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.formula-item label {
  font-weight: bold;
  min-width: 60px;
}

.formula-item input,
.formula-item select {
  width: 100px;
  padding: 6px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.formula-result {
  padding: 10px;
  background-color: #e8f5e9;
  border-radius: 4px;
}

.formula-expression {
  margin: 5px 0;
  font-size: 14px;
  color: #333;
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