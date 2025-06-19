<template>
  <div class="event-driven-table-demo">
    <h1>事件驱动表格示例</h1>
    <p>此示例展示了使用事件总线模式解耦视图操作和逻辑操作的表格实现</p>
    
    <div class="controls">
      <button class="add-button" @click="addRandomRow">添加随机数据</button>
      <button class="clear-button" @click="clearSelection">清除选择</button>
    </div>
    
    <div class="event-log">
      <h3>事件日志</h3>
      <div class="log-content">
        <div v-for="(log, index) in eventLogs" :key="index" class="log-item" :class="getEventClass(log)">
          <span class="event-time">{{ log.time }}</span>
          <span class="event-type">{{ log.eventType }}</span>
          <span class="event-detail">{{ log.detail }}</span>
        </div>
      </div>
      <div class="log-controls">
        <button @click="clearLogs">清空日志</button>
      </div>
    </div>
    
    <div class="table-container" ref="tableContainer"></div>
    
    <!-- 分页组件 -->
    <GridPagination 
      v-if="gridApi"
      :api="gridApi" 
      :totalItems="totalItems"
      :page="currentPage"
      :pageSize="pageSize"
      @page-changed="handlePageChanged"
    />
  </div>
</template>

<script>
import { Grid } from '@grid-table/core';
import { ref, onMounted, onUnmounted } from 'vue';
import DeleteButtonComponent from '../components/DeleteButtonComponent.vue';
import ButtonCellComponent from '../components/ButtonCellComponent.vue';
import GridPagination from '../components/GridPagination.vue';

export default {
  name: 'EventDrivenTableDemo',
  components: {
    GridPagination
  },
  setup() {
    // 创建响应式变量
    const tableContainer = ref(null);
    const gridApi = ref(null);
    const eventLogs = ref([]);
    
    // 分页相关状态
    const allData = ref([]);
    const displayData = ref([]);
    const totalItems = ref(0);
    const currentPage = ref(1);
    const pageSize = ref(10);
    
    // 生成随机数据
    const generateData = (count = 50) => {
      const data = [];
      const statuses = ['活跃', '已禁用', '待审核'];
      const cities = ['北京', '上海', '广州', '深圳', '杭州', '成都', '武汉'];
      
      for (let i = 0; i < count; i++) {
        data.push({
          id: i + 1,
          name: `用户-${Math.floor(Math.random() * 10000)}`,
          age: Math.floor(Math.random() * 50) + 18,
          status: statuses[Math.floor(Math.random() * statuses.length)],
          city: cities[Math.floor(Math.random() * cities.length)],
          score: Math.floor(Math.random() * 100),
          active: Math.random() > 0.5,
          registrationDate: new Date(Date.now() - Math.floor(Math.random() * 10000000000)).toISOString().split('T')[0]
        });
      }
      
      return data;
    };
    
    // 处理分页数据
    const updateDisplayData = () => {
      const start = (currentPage.value - 1) * pageSize.value;
      const end = start + pageSize.value;
      displayData.value = allData.value.slice(start, end);
      
      // 如果表格已初始化，更新表格数据
      if (gridApi.value) {
        gridApi.value.setRowData(displayData.value);
      }
    };
    
    // 分页变更处理
    const handlePageChanged = (event) => {
      currentPage.value = event.page;
      pageSize.value = event.pageSize;
      updateDisplayData();
      
      addLog('pageChanged', `页码: ${event.page}, 每页大小: ${event.pageSize}`);
    };
    
    // 日志帮助函数
    const addLog = (eventType, detail) => {
      const time = new Date().toLocaleTimeString();
      eventLogs.value.unshift({ time, eventType, detail });
      // 限制日志数量
      if (eventLogs.value.length > 100) {
        eventLogs.value = eventLogs.value.slice(0, 100);
      }
    };
    
    const clearLogs = () => {
      eventLogs.value = [];
    };
    
    const getEventClass = (log) => {
      const type = log.eventType.toLowerCase();
      if (type.includes('changed')) return 'log-changed';
      if (type.includes('action')) return 'log-action';
      if (type.includes('request')) return 'log-request';
      return '';
    };
    
    // 表格操作
    const addRandomRow = () => {
      if (!gridApi.value) return;
      
      const newData = generateData(1)[0];
      newData.id = allData.value.length + 1;
      
      // 添加到全部数据
      allData.value.push(newData);
      totalItems.value = allData.value.length;
      
      // 更新当前页数据
      updateDisplayData();
      
      // 如果是当前页的数据，通过事件总线添加
      const start = (currentPage.value - 1) * pageSize.value;
      const end = start + pageSize.value;
      if (allData.value.length > start && allData.value.length <= end) {
        const eventBus = gridApi.value.getEventBus();
        eventBus.publish('gridDataAction', {
          type: 'rowAddRequest',
          data: newData,
          position: 'bottom',
          autoScroll: true,
          source: 'addButton'
        });
      }
    };
    
    const clearSelection = () => {
      if (!gridApi.value) return;
      gridApi.value.deselectAll();
    };
    
    // 生命周期钩子
    onMounted(() => {
      // 初始化数据
      allData.value = generateData(50);
      totalItems.value = allData.value.length;
      updateDisplayData();
      
      // 表格配置
      const gridOptions = {
        rowData: displayData.value,
        rowHeight: 40,
        headerHeight: 50,
        rowKeyField: 'id', // 用于唯一标识行的字段
        columns: [
          {
            field: 'selected',
            headerName: '选择',
            width: 60,
            headerComponent: 'CheckboxHeader',
            cellRenderer: 'CheckboxCell',
            suppressSizeToFit: true,
            resizable: false,
            sortable: false
          },
          {
            field: 'id',
            headerName: 'ID',
            sortable: true,
            width: 80,
            suppressSizeToFit: true,
            resizable: true
          },
          {
            field: 'name',
            headerName: '姓名',
            sortable: true,
            width: 120,
            resizable: true
          },
          {
            field: 'age',
            headerName: '年龄',
            sortable: true,
            width: 80,
            resizable: true
          },
          {
            field: 'status',
            headerName: '状态',
            sortable: true,
            width: 100,
            resizable: true
          },
          {
            field: 'city',
            headerName: '城市',
            sortable: true,
            width: 100,
            resizable: true
          },
          {
            field: 'score',
            headerName: '分数',
            sortable: true,
            width: 80,
            resizable: true
          },
          {
            field: 'registrationDate',
            headerName: '注册日期',
            sortable: true,
            width: 120,
            resizable: true
          },
          {
            field: 'active',
            headerName: '活跃',
            sortable: true,
            width: 80,
            resizable: true,
            valueFormatter: (params) => params.value ? '是' : '否'
          },
          {
            field: 'edit',
            headerName: '编辑',
            sortable: false,
            width: 100,
            resizable: false,
            cellComponent: 'ButtonCell',
            cellComponentParams: {
              text: '编辑'
            }
          },
          {
            field: 'delete',
            headerName: '操作',
            sortable: false,
            width: 100,
            resizable: false,
            cellComponent: 'DeleteButton'
          }
        ],
        // 全局组件注册
        components: {
          DeleteButton: DeleteButtonComponent,
          ButtonCell: ButtonCellComponent
        }
      };
      
      // 创建表格
      const grid = new Grid(gridOptions);
      grid.render(tableContainer.value);
      gridApi.value = grid;
      
      // 注册事件监听
      const eventBus = grid.getEventBus();
      
      // 监听数据变更事件
      eventBus.subscribe('gridDataChanged', (event) => {
        let detailMsg = '';
        
        switch(event.type) {
          case 'rowAdded':
            detailMsg = `添加行: ID=${event.data.id}, 位置=${event.position}`;
            break;
          case 'rowRemoved':
            detailMsg = `删除行: ID=${event.id}`;
            // 从allData中移除
            const index = allData.value.findIndex(item => item.id == event.id);
            if (index !== -1) {
              allData.value.splice(index, 1);
              totalItems.value = allData.value.length;
            }
            break;
          case 'rowUpdated':
            detailMsg = `更新行: ID=${event.rowId}`;
            // 更新allData中的数据
            const itemIndex = allData.value.findIndex(item => item.id == event.rowId);
            if (itemIndex !== -1 && event.data) {
              allData.value[itemIndex] = { ...event.data };
            }
            break;
          case 'dataLoaded':
            detailMsg = `数据加载完成, 共${event.data.length}条`;
            break;
          case 'cellValueChanged':
            detailMsg = `单元格值变更: 行ID=${event.nodeId}, 字段=${event.field}, 新值=${event.newValue}`;
            break;
          default:
            detailMsg = JSON.stringify(event);
        }
        
        addLog('gridDataChanged', detailMsg);
      });
      
      // 监听选择变更事件
      eventBus.subscribe('gridSelectionChanged', (event) => {
        let detailMsg = '';
        
        switch(event.type) {
          case 'selectAll':
            detailMsg = `全选, 共${event.selectedRows.length}行`;
            break;
          case 'deselectAll':
            detailMsg = `取消全选`;
            break;
          case 'rowSelected':
            detailMsg = `行选择: ${event.selectedRows.length}行`;
            break;
          case 'rowDeleted':
            detailMsg = `行删除后选择更新: ${event.selectedRows.length}/${event.totalRows}行`;
            break;
          default:
            detailMsg = JSON.stringify(event);
        }
        
        addLog('gridSelectionChanged', detailMsg);
      });
      
      // 监听数据操作请求事件
      eventBus.subscribe('gridDataAction', (event) => {
        let detailMsg = '';
        
        switch(event.type) {
          case 'rowAddRequest':
            detailMsg = `添加行请求, 位置=${event.position}, 来源=${event.source || '未知'}`;
            break;
          case 'rowDeleteRequest':
            detailMsg = `删除行请求: ID=${event.rowId}, 来源=${event.source || '未知'}`;
            break;
          case 'rowUpdateRequest':
            detailMsg = `更新行请求: ID=${event.rowId}, 来源=${event.source || '未知'}`;
            break;
          default:
            detailMsg = JSON.stringify(event);
        }
        
        addLog('gridDataAction', detailMsg);
      });
      
      // 监听单元格操作事件
      eventBus.subscribe('gridCellAction', (event) => {
        let detailMsg = '';
        
        switch(event.type) {
          case 'checkboxSelect':
            detailMsg = `行复选框操作: ${event.action === 'select' ? '选择' : '取消选择'}行ID=${event.nodeId}`;
            break;
          case 'headerCheckboxSelect':
            detailMsg = `表头复选框操作: ${event.action}`;
            break;
          default:
            detailMsg = JSON.stringify(event);
        }
        
        addLog('gridCellAction', detailMsg);
      });
      
      // 监听UI操作事件
      eventBus.subscribe('gridUIAction', (event) => {
        let detailMsg = '';
        
        switch(event.type) {
          case 'sortRequest':
            detailMsg = `排序请求: 列=${event.colId}, 排序=${event.sort}, 来源=${event.source || '未知'}`;
            break;
          case 'filterRequest':
            detailMsg = `过滤请求: 列=${event.colId}, 来源=${event.source || '未知'}`;
            break;
          case 'pageChangeRequest':
            detailMsg = `分页请求: 页码=${event.pageNumber}, 每页大小=${event.pageSize}, 来源=${event.source || '未知'}`;
            break;
          default:
            detailMsg = JSON.stringify(event);
        }
        
        addLog('gridUIAction', detailMsg);
      });
      
      // 监听UI变更事件
      eventBus.subscribe('gridUIChanged', (event) => {
        let detailMsg = '';
        
        switch(event.type) {
          case 'sortChanged':
            detailMsg = `排序已变更: ${JSON.stringify(event.sortModel)}`;
            break;
          case 'filterChanged':
            detailMsg = `过滤已变更: 列=${event.colId}`;
            break;
          case 'pageChanged':
            detailMsg = `分页已变更: 页码=${event.pageNumber}, 每页大小=${event.pageSize}`;
            break;
          default:
            detailMsg = JSON.stringify(event);
        }
        
        addLog('gridUIChanged', detailMsg);
      });
    });
    
    onUnmounted(() => {
      if (gridApi.value) {
        gridApi.value.destroy();
      }
    });
    
    return {
      tableContainer,
      gridApi,
      eventLogs,
      totalItems,
      currentPage,
      pageSize,
      addRandomRow,
      clearSelection,
      clearLogs,
      getEventClass,
      handlePageChanged
    };
  }
}
</script>

<style scoped>
.event-driven-table-demo {
  padding: 20px;
  display: flex;
  flex-direction: column;
  height: 100vh;
}

h1 {
  margin-bottom: 10px;
}

.controls {
  margin: 20px 0;
  display: flex;
  gap: 10px;
}

.controls button {
  padding: 8px 16px;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.3s;
}

.add-button {
  background-color: #52c41a;
  color: white;
}

.add-button:hover {
  background-color: #73d13d;
}

.clear-button {
  background-color: #faad14;
  color: white;
}

.clear-button:hover {
  background-color: #ffc53d;
}

.table-container {
  flex: 1;
  min-height: 400px;
  border: 1px solid #e8e8e8;
  border-radius: 4px;
}

.event-log {
  height: 300px;
  border: 1px solid #e8e8e8;
  border-radius: 4px;
  margin-bottom: 20px;
  display: flex;
  flex-direction: column;
}

.event-log h3 {
  padding: 8px 16px;
  margin: 0;
  border-bottom: 1px solid #e8e8e8;
  background-color: #fafafa;
}

.log-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  font-family: monospace;
  font-size: 12px;
}

.log-item {
  padding: 4px 8px;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
}

.log-item:last-child {
  border-bottom: none;
}

.log-item:hover {
  background-color: #f9f9f9;
}

.event-time {
  width: 80px;
  color: #888;
  margin-right: 10px;
}

.event-type {
  width: 150px;
  font-weight: bold;
  margin-right: 10px;
}

.event-detail {
  flex: 1;
}

.log-changed {
  background-color: #e6f7ff;
}

.log-action {
  background-color: #fff7e6;
}

.log-request {
  background-color: #f6ffed;
}

.log-controls {
  padding: 8px;
  border-top: 1px solid #e8e8e8;
  text-align: right;
}

.log-controls button {
  padding: 4px 8px;
  background-color: #f5f5f5;
  border: 1px solid #d9d9d9;
  border-radius: 2px;
  cursor: pointer;
  font-size: 12px;
}

.log-controls button:hover {
  background-color: #e8e8e8;
}
</style> 