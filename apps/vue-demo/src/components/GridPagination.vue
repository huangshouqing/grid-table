<template>
  <div class="grid-pagination">
    <div class="page-info">
      共 {{ totalItems }} 条记录，每页 
      <select v-model="currentPageSize" @change="onPageSizeChange">
        <option v-for="size in pageSizes" :key="size" :value="size">{{ size }}</option>
      </select>
      条，共 {{ totalPages }} 页
    </div>
    <div class="page-buttons">
      <button 
        class="page-btn" 
        :disabled="currentPage === 1" 
        @click="changePage(1)"
      >首页</button>
      <button 
        class="page-btn" 
        :disabled="currentPage === 1" 
        @click="changePage(currentPage - 1)"
      >上一页</button>
      <div class="page-numbers">
        <button 
          v-for="pageNumber in displayedPages" 
          :key="pageNumber" 
          :class="['page-number', { active: pageNumber === currentPage }]"
          @click="changePage(pageNumber)"
        >
          {{ pageNumber }}
        </button>
      </div>
      <button 
        class="page-btn" 
        :disabled="currentPage === totalPages" 
        @click="changePage(currentPage + 1)"
      >下一页</button>
      <button 
        class="page-btn" 
        :disabled="currentPage === totalPages" 
        @click="changePage(totalPages)"
      >尾页</button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'GridPagination',
  props: {
    // 表格API
    api: {
      type: Object,
      required: true
    },
    // 总记录数
    totalItems: {
      type: Number,
      default: 0
    },
    // 每页显示数量
    pageSize: {
      type: Number,
      default: 10
    },
    // 当前页码
    page: {
      type: Number,
      default: 1
    }
  },
  data() {
    return {
      currentPage: this.page,
      currentPageSize: this.pageSize,
      pageSizes: [10, 20, 50, 100]
    }
  },
  watch: {
    page(newVal) {
      this.currentPage = newVal;
    },
    pageSize(newVal) {
      this.currentPageSize = newVal;
    }
  },
  computed: {
    // 总页数
    totalPages() {
      return Math.ceil(this.totalItems / this.currentPageSize) || 1;
    },
    // 显示的页码数组
    displayedPages() {
      const pages = [];
      const maxVisiblePages = 5; // 最多显示5个页码
      
      let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
      let endPage = Math.min(this.totalPages, startPage + maxVisiblePages - 1);
      
      if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
      }
      
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
      
      return pages;
    }
  },
  methods: {
    // 切换页码
    changePage(pageNumber) {
      if (pageNumber === this.currentPage) return;
      
      this.currentPage = pageNumber;
      this.publishPageChangeEvent();
    },
    
    // 切换每页显示数量
    onPageSizeChange() {
      // 重新计算当前页码，确保不超出范围
      const newTotalPages = Math.ceil(this.totalItems / this.currentPageSize) || 1;
      if (this.currentPage > newTotalPages) {
        this.currentPage = newTotalPages;
      }
      
      this.publishPageChangeEvent();
    },
    
    // 发布分页变更事件
    publishPageChangeEvent() {
      const eventBus = this.api.getEventBus();
      if (eventBus) {
        eventBus.publish('gridUIAction', {
          type: 'pageChangeRequest',
          pageNumber: this.currentPage,
          pageSize: this.currentPageSize,
          source: 'pagination'
        });
      }
      
      // 同时触发Vue事件，以便父组件可以监听
      this.$emit('page-changed', {
        page: this.currentPage,
        pageSize: this.currentPageSize
      });
    }
  }
}
</script>

<style scoped>
.grid-pagination {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  font-size: 14px;
}

.page-info select {
  margin: 0 5px;
  padding: 2px 5px;
  border: 1px solid #d9d9d9;
  border-radius: 2px;
}

.page-buttons {
  display: flex;
  align-items: center;
}

.page-btn {
  padding: 5px 10px;
  margin: 0 3px;
  border: 1px solid #d9d9d9;
  background-color: #fff;
  border-radius: 2px;
  cursor: pointer;
  font-size: 12px;
}

.page-btn:disabled {
  color: #d9d9d9;
  cursor: not-allowed;
}

.page-btn:not(:disabled):hover {
  color: #1890ff;
  border-color: #1890ff;
}

.page-numbers {
  display: flex;
  margin: 0 5px;
}

.page-number {
  width: 32px;
  height: 32px;
  margin: 0 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #d9d9d9;
  border-radius: 2px;
  background-color: #fff;
  cursor: pointer;
}

.page-number:hover {
  color: #1890ff;
  border-color: #1890ff;
}

.page-number.active {
  background-color: #1890ff;
  border-color: #1890ff;
  color: #fff;
  cursor: default;
}
</style> 