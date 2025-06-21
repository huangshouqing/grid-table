import { CellComponent, ComponentParams } from '../types';

/**
 * TreeCellRenderer - 专门为树形表格设计的内容渲染器
 * 
 * 特性：
 * 1. 支持展开/折叠功能
 * 2. 根据节点层级自动缩进
 * 3. 显示树形节点内容
 * 4. 支持添加子节点功能
 */
export class TreeCellRenderer implements CellComponent {
    private params!: ComponentParams;
    private element!: HTMLElement;

    init(params: ComponentParams): void {
        this.params = params;
        this.element = document.createElement('div');
        this.element.className = 'grid-tree-cell';
        this.element.style.display = 'flex';
        this.element.style.alignItems = 'center';
        this.element.style.height = '100%';
        
        // 根据节点层级添加缩进
        if (this.params.node.level && this.params.node.level > 0) {
            const indent = document.createElement('span');
            indent.className = 'grid-tree-indent';
            indent.style.width = `${this.params.node.level * 20}px`;
            this.element.appendChild(indent);
        }
        
        // 如果有子节点，显示展开/折叠图标
        if (this.params.node.children && this.params.node.children.length > 0) {
            const expandButton = document.createElement('div');
            expandButton.className = 'grid-tree-expand-button';
            expandButton.innerHTML = this.params.node.expanded 
                ? '<svg width="16" height="16" viewBox="0 0 16 16"><path d="M3 8l5 5 5-5z"/></svg>' 
                : '<svg width="16" height="16" viewBox="0 0 16 16"><path d="M6 3l5 5-5 5z"/></svg>';
            
            expandButton.addEventListener('click', (e: Event) => this.onExpandClick(e));
            this.element.appendChild(expandButton);
        } else {
            // 如果没有子节点，添加一个占位符，保持对齐
            const placeholder = document.createElement('div');
            placeholder.style.width = '20px';
            this.element.appendChild(placeholder);
        }
        
        // 添加"新增子阶"按钮
        const addChildButton = document.createElement('div');
        addChildButton.className = 'grid-tree-add-child-button';
        addChildButton.title = '新增子阶';
        addChildButton.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16"><path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="2"/></svg>';
        addChildButton.addEventListener('click', (e: Event) => this.onAddChildClick(e));
        this.element.appendChild(addChildButton);
        
        // 显示单元格内容
        const contentSpan = document.createElement('span');
        contentSpan.className = 'grid-tree-content';
        contentSpan.textContent = this.params.value !== undefined ? this.params.value.toString() : '';
        this.element.appendChild(contentSpan);
    }

    getGui(): HTMLElement {
        return this.element;
    }

    refresh(params: ComponentParams): boolean {
        this.params = params;
        
        // 清空当前内容
        while (this.element.firstChild) {
            this.element.removeChild(this.element.firstChild);
        }
        
        // 重新初始化
        this.init(params);
        
        return true;
    }

    destroy(): void {
        // 移除展开按钮的事件监听
        const expandButton = this.element.querySelector('.grid-tree-expand-button');
        if (expandButton) {
            expandButton.removeEventListener('click', (e: Event) => this.onExpandClick(e));
        }
        
        // 移除添加子节点按钮的事件监听
        const addChildButton = this.element.querySelector('.grid-tree-add-child-button');
        if (addChildButton) {
            addChildButton.removeEventListener('click', (e: Event) => this.onAddChildClick(e));
        }
    }
    
    private onExpandClick(event: Event): void {
        event.stopPropagation();
        
        const node = this.params.node;
        
        // 切换展开状态
        node.expanded = !node.expanded;
        
        // 刷新视图
        this.params.api.refreshView();
    }
    
    private onAddChildClick(event: Event): void {
        event.stopPropagation();
        
        const node = this.params.node;
        const api = this.params.api;
        
        // 创建一个新的子节点数据
        const newChildData = {
            id: `${node.id}_child_${Date.now()}`, // 生成唯一ID
            parentId: node.id, // 设置父节点ID
            // 复制当前行的数据结构，但值设为空
            ...Object.keys(node.data).reduce((obj, key) => {
                if (key !== 'id' && key !== 'parentId') {
                    obj[key] = '';
                }
                return obj;
            }, {} as any),
            // 添加children数组，确保树形结构正确
            children: []
        };
        
        // 确保父节点处于展开状态
        if (!node.expanded) {
            node.expanded = true;
        }
        
        // 检查父节点是否已有children数组
        if (!node.data.children) {
            node.data.children = [];
        }
        
        // 将新子节点添加到父节点的children数组中
        node.data.children.push(newChildData);
        
        // 获取当前完整的数据集
        let currentData: any[] = [];
        api.forEachNode(node => {
            // 只收集顶级节点，子节点会通过children属性包含
            if (!node.parent) {
                currentData.push(node.data);
            }
        });
        
        // 使用setRowData触发整个表格的重新初始化
        // 这会正确处理树形结构和父子关系，同时保留展开状态
        api.setRowData(currentData, true);
        
        // 等待DOM更新后处理选择状态
        setTimeout(() => {
            // 获取新创建的节点
            const newNode = api.getRowNode(newChildData.id);
            if (newNode) {
                // 如果父节点被选中，子节点也应该被选中
                if (node.selected) {
                    api.selectRow(newNode.id, false); // 不清除其他选择
                }
                
                // 确保父节点的选择状态正确反映子节点状态
                // 这会触发 updateParentNodeSelection 方法
                if (node.parent) {
                    const parentNode = api.getRowNode(node.parent.id);
                    if (parentNode) {
                        // 重新计算父节点的选择状态
                        const isSelected = parentNode.selected;
                        if (isSelected) {
                            api.selectRow(parentNode.id, false);
                        } else {
                            api.deselectRow(parentNode.id, true);
                        }
                    }
                }
                
                // 滚动到新节点
                api.ensureNodeVisible(newNode);
            }
        }, 100); // 延长延迟，确保DOM完全更新
    }
} 