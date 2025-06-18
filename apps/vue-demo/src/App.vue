<template>
  <div class="app">
    <h1>Grid Table Vue Demo</h1>
    
    <!-- 事件通知区域 -->
    <div v-if="lastEvent" class="event-notification" :class="lastEvent.type">
      <div class="notification-header">
        <strong>{{ getEventTitle(lastEvent) }}</strong>
        <button @click="clearNotification" class="close-btn">×</button>
      </div>
      <div class="notification-body">
        {{ getEventMessage(lastEvent) }}
      </div>
    </div>
    
    <!-- 表格组件，添加事件监听 -->
    <GridTable 
      @data-changed="handleDataChanged"
      @selection-changed="handleSelectionChanged"
      @grid-ready="handleGridReady"
    />
  </div>
</template>

<script>
import { ref } from 'vue'
import GridTable from './components/GridTable.vue'

export default {
  name: 'App',
  components: {
    GridTable
  },
  setup() {
    // 跨组件通信示例 - 存储最后一个事件
    const lastEvent = ref(null);
    const gridApi = ref(null);
    const eventBus = ref(null);
    
    // 处理数据变更事件
    const handleDataChanged = (event) => {
      console.log('App收到数据变更事件:', event);
      lastEvent.value = {
        ...event,
        category: 'data'
      };
      
      // 5秒后自动清除通知
      setTimeout(() => {
        if (lastEvent.value && lastEvent.value.category === 'data' && 
            lastEvent.value.type === event.type) {
          clearNotification();
        }
      }, 5000);
    };
    
    // 处理选择变更事件
    const handleSelectionChanged = (event) => {
      console.log('App收到选择变更事件:', event);
      lastEvent.value = {
        ...event,
        category: 'selection'
      };
      
      // 3秒后自动清除通知
      setTimeout(() => {
        if (lastEvent.value && lastEvent.value.category === 'selection') {
          clearNotification();
        }
      }, 3000);
    };
    
    // 处理表格准备完毕事件
    const handleGridReady = (params) => {
      console.log('表格已准备就绪:', params);
      gridApi.value = params.gridApi;
      eventBus.value = params.eventBus;
      
      // 演示：通过事件总线直接订阅特定事件
      // 这是事件总线的强大之处 - 无需修改源组件也能监听内部事件
      if (eventBus.value) {
        eventBus.value.subscribe('gridDataChanged', (event) => {
          if (event.type === 'rowAdded') {
            console.log('App直接通过事件总线监听到行添加:', event.data);
          }
        });
      }
    };
    
    // 清除通知
    const clearNotification = () => {
      lastEvent.value = null;
    };
    
    // 获取事件标题
    const getEventTitle = (event) => {
      if (!event) return '';
      
      const titles = {
        data: {
          cellValueChanged: '单元格数据已更新',
          rowAdded: '行已添加',
          rowRemoved: '行已删除',
          rowMoved: '行已移动',
          dataLoaded: '数据已加载'
        },
        selection: {
          selectAll: '已全选',
          deselectAll: '已取消全选',
          rowSelected: '行已选择'
        }
      };
      
      return titles[event.category]?.[event.type] || '事件通知';
    };
    
    // 获取事件消息
    const getEventMessage = (event) => {
      if (!event) return '';
      
      switch(event.type) {
        case 'cellValueChanged':
          return `字段 "${event.field}" 的值已更改为 "${event.newValue}"`;
        case 'rowAdded':
          return `已添加新行，ID: ${event.data.id}`;
        case 'rowRemoved':
          return `已删除行，ID: ${event.id}`;
        case 'rowMoved':
          return `行已从位置 ${event.fromIndex} 移动到 ${event.toIndex}`;
        case 'dataLoaded':
          return `已加载 ${event.data?.length || 0} 行数据`;
        case 'selectAll':
          return '已选择所有行';
        case 'deselectAll':
          return '已取消所有选择';
        case 'rowSelected':
          return `已选择 ${event.count} 行`;
        default:
          return JSON.stringify(event);
      }
    };
    
    return {
      lastEvent,
      gridApi,
      handleDataChanged,
      handleSelectionChanged,
      handleGridReady,
      clearNotification,
      getEventTitle,
      getEventMessage
    };
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

.event-notification {
  margin-bottom: 20px;
  border-radius: 4px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from { transform: translateY(-20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.notification-header {
  padding: 10px 15px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: white;
}

.notification-body {
  padding: 15px;
  background-color: white;
  border: 1px solid #ddd;
  border-top: none;
}

.close-btn {
  background: none;
  border: none;
  color: white;
  font-size: 18px;
  cursor: pointer;
  opacity: 0.7;
}

.close-btn:hover {
  opacity: 1;
}

/* 事件类型样式 */
.cellValueChanged .notification-header { background-color: #2196F3; }
.rowAdded .notification-header { background-color: #4CAF50; }
.rowRemoved .notification-header { background-color: #F44336; }
.rowMoved .notification-header { background-color: #FF9800; }
.dataLoaded .notification-header { background-color: #9C27B0; }
.selectAll .notification-header, 
.deselectAll .notification-header,
.rowSelected .notification-header { background-color: #607D8B; }
</style>