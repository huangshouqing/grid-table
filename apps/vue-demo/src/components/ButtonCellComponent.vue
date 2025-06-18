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
            // 在显示详情对话框前，确保获取最新的行数据
            try {
                const rowId = this.data.id;
                if (this.api && typeof this.api.getRowNode === 'function') {
                    // 通过API获取最新的行节点
                    const node = this.api.getRowNode(rowId);
                    if (node && node.data) {
                        // 更新本地数据
                        this.rowData = JSON.parse(JSON.stringify(node.data));
                        console.log('详情按钮点击，已获取最新行数据:', this.rowData);
                    }
                }
            } catch (error) {
                console.error('获取最新行数据出错:', error);
                // 回退到使用当前的props数据
                this.rowData = JSON.parse(JSON.stringify(this.data || {}));
            }
            
            // 显示详情对话框
            this.showDialog = true;
        },
        onSaveData(updatedData) {
            try {
                const rowId = this.data.id;
                
                // 使用Grid API更新数据
                if (this.api && typeof this.api.updateRowData === 'function') {
                    // 更新数据
                    this.api.updateRowData(rowId, updatedData);
                    
                    // 刷新本行
                    if (typeof this.api.refreshRow === 'function' && this.rowIndex >= 0) {
                        this.api.refreshRow(this.rowIndex);
                    }
                    
                    // 更新本地数据
                    this.rowData = JSON.parse(JSON.stringify(updatedData));
                    console.log('数据已更新，行已刷新');
                } else {
                    console.warn('Grid API不可用或缺少updateRowData方法');
                }
            } catch (error) {
                console.error('更新数据时出错:', error);
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