<template>
  <div class="delete-button-cell">
    <button class="delete-button" @click="onDelete">删除</button>
  </div>
</template>

<script>
export default {
  name: 'DeleteButtonComponent',
  props: {
    // 行数据
    data: {
      type: Object,
      required: true
    },
    // grid-table API
    api: {
      type: Object,
      default: null
    },
    // 行索引
    rowIndex: {
      type: Number,
      default: -1
    }
  },
  methods: {
    onDelete() {
      const rowId = this.data.id;
      
      // 获取事件总线
      const eventBus = this.api.getEventBus();
      
      // 发布删除请求事件
      if (eventBus) {
        eventBus.publish('gridDataAction', {
          type: 'rowDeleteRequest',
          rowId: rowId,
          data: this.data,
          source: 'deleteButton'
        });
      } else {
        // 降级处理：如果事件总线不可用，则使用直接API调用
        this.api.removeRow(rowId);
        this.api.refreshView();
      }
    }
  }
}
</script>

<style scoped>
.delete-button-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 0 5px;
}

.delete-button {
  padding: 4px 12px;
  background-color: #ff4d4f;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: background-color 0.3s;
}

.delete-button:hover {
  background-color: #ff7875;
}
</style>