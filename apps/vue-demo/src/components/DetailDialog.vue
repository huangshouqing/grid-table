<template>
  <div class="detail-dialog-wrapper" v-if="visible">
    <div class="detail-dialog">
      <div class="dialog-header">
        <h3>{{ title || '详情' }}</h3>
        <button class="close-btn" @click="onCancel">×</button>
      </div>
      <div class="dialog-content">
        <div class="form-group" v-for="(value, key) in editableFields" :key="key">
          <label :for="key">{{ getFieldLabel(key) }}:</label>
          <input 
            :id="key" 
            v-model="formData[key]" 
            :type="getInputType(key, value)" 
            :disabled="key === 'id'"
          />
        </div>
      </div>
      <div class="dialog-footer">
        <button class="cancel-btn" @click="onCancel">取消</button>
        <button class="save-btn" @click="onSave">保存</button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'DetailDialog',
  props: {
    data: {
      type: Object,
      default: () => ({})
    },
    title: {
      type: String,
      default: '详情'
    },
    visible: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      formData: {}
    }
  },
  computed: {
    // 只显示可编辑的字段（排除ID）
    editableFields() {
      const result = {};
      Object.keys(this.formData).forEach(key => {
        if (key !== 'id') {
          result[key] = this.formData[key];
        }
      });
      return result;
    }
  },
  watch: {
    data: {
      handler(newVal) {
        // 深拷贝以避免直接修改props
        this.formData = JSON.parse(JSON.stringify(newVal || {}));
      },
      immediate: true,
      deep: true
    },
    visible(newVal) {
      if (newVal) {
        // 当显示弹框时，重新复制数据
        this.formData = JSON.parse(JSON.stringify(this.data || {}));
      }
    }
  },
  methods: {
    getFieldLabel(field) {
      const labels = {
        id: 'ID',
        name: '产品名称',
        price: '价格',
        quantity: '数量',
        status: '状态',
        rating: '评分',
      };
      return labels[field] || field;
    },
    getInputType(key, value) {
      if (key === 'price' || key === 'quantity' || key === 'rating') {
        return 'number';
      }
      return 'text';
    },
    onCancel() {
      this.$emit('update:visible', false);
      this.$emit('cancel');
    },
    onSave() {
      this.$emit('save', this.formData);
      this.$emit('update:visible', false);
    }
  }
}
</script>

<style scoped>
.detail-dialog-wrapper {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.detail-dialog {
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.2);
  width: 500px;
  max-width: 90%;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #eee;
}

.dialog-header h3 {
  margin: 0;
  font-size: 18px;
  color: #333;
}

.close-btn {
  background: none;
  border: none;
  font-size: 22px;
  color: #999;
  cursor: pointer;
}

.dialog-content {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-weight: 500;
  color: #333;
}

.form-group input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.dialog-footer {
  padding: 16px 20px;
  border-top: 1px solid #eee;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.dialog-footer button {
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.cancel-btn {
  background-color: #f5f5f5;
  border: 1px solid #ddd;
  color: #666;
}

.save-btn {
  background-color: #1890ff;
  border: 1px solid #1890ff;
  color: white;
}

.save-btn:hover {
  background-color: #40a9ff;
}
</style> 