<template>
    <div class="button-cell">
        <button class="grid-button" @click="onClick">{{ text }}</button>
        <DetailDialog :visible="showDialog" @update:visible="showDialog = $event" :data="rowData"
            :title="`编辑 ${rowData.name || ''}的信息`" @save="onSaveData" />
    </div>
</template>

<script>
import DetailDialog from './DetailDialog.vue';

export default {
    name: 'ButtonCellComponent',
    components: {
        DetailDialog
    },
    props: {
        // 行数据
        data: {
            type: Object,
            required: true
        },
        // 按钮文本
        text: {
            type: String,
            default: '查看详情'
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
    data() {
        return {
            showDialog: false,
            rowData: null
        }
    },
    created() {
        // 初始化行数据（深拷贝，避免直接修改props）
        this.rowData = JSON.parse(JSON.stringify(this.data || {}));
    },
    watch: {
        data: {
            handler(newVal) {
                this.rowData = JSON.parse(JSON.stringify(newVal || {}));
            },
            deep: true
        }
    },
    methods: {
        onClick() {
            // 显示详情对话框
            this.showDialog = true;
        },
        onSaveData(updatedData) {
            debugger
            if (this.api && this.api.onComplete && this.rowIndex >= 0) {
                // 使用grid-table API更新数据
                this.api.onComplete(updatedData);

                // 更新本地数据
                this.rowData = { ...updatedData };

                console.log('数据已更新:', updatedData);
            } else {
                console.warn('无法更新数据，API不可用或行索引无效');
            }
        }
    }
}
</script>

<style scoped>
.button-cell {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 0 5px;
}

.grid-button {
    padding: 4px 12px;
    background-color: #1890ff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    transition: background-color 0.3s;
}

.grid-button:hover {
    background-color: #40a9ff;
}
</style>