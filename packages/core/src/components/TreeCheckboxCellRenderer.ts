import { CellComponent, ComponentParams } from '../types';

/**
 * TreeCheckboxCellRenderer - 专门为树形表格设计的复选框渲染器
 * 
 * 特性：
 * 1. 支持半选状态显示
 * 2. 支持父子节点联动选择
 * 3. 针对树形结构优化的性能
 */
export class TreeCheckboxCellRenderer implements CellComponent {
    private params!: ComponentParams;
    private element!: HTMLElement;
    private checkbox!: HTMLInputElement;

    init(params: ComponentParams): void {
        this.params = params;
        this.element = document.createElement('div');
        this.element.className = 'grid-tree-checkbox-cell';
        this.element.style.display = 'flex';
        this.element.style.alignItems = 'center';
        this.element.style.justifyContent = 'center';
        this.element.style.height = '100%';
        
        // 创建复选框元素
        this.checkbox = document.createElement('input');
        this.checkbox.type = 'checkbox';
        this.checkbox.className = 'grid-tree-checkbox';
        
        // 设置复选框状态
        this.updateCheckboxState();
        
        // 添加事件监听
        this.checkbox.addEventListener('click', this.onCheckboxClick.bind(this));
        this.checkbox.addEventListener('change', this.onCheckboxChange.bind(this));
        
        this.element.appendChild(this.checkbox);
    }

    getGui(): HTMLElement {
        return this.element;
    }

    refresh(params: ComponentParams): boolean {
        this.params = params;
        this.updateCheckboxState();
        return true;
    }

    destroy(): void {
        // 移除所有事件监听器
        this.checkbox.removeEventListener('click', this.onCheckboxClick.bind(this));
        this.checkbox.removeEventListener('change', this.onCheckboxChange.bind(this));
    }

    /**
     * 更新复选框状态，处理选中和半选状态
     */
    private updateCheckboxState(): void {
        const node = this.params.node;
        const api = this.params.api;
        
        // 设置复选框选中状态
        this.checkbox.checked = node.selected;
        
        // 检查半选状态
        this.checkbox.indeterminate = api.isNodeIndeterminate(node.id);
    }

    private onCheckboxClick(event: Event): void {
        // 阻止事件冒泡
        event.stopPropagation();
        
        // 不需要手动保存滚动位置，Grid 类内部会处理
    }

    private onCheckboxChange(event: Event): void {
        const api = this.params.api;
        if (!api) return;
        
        // 使用事件总线发布全选/取消全选事件
        if (this.checkbox.checked) {
            api.selectAll();
        } else {
            api.deselectAll();
        }
        
        // Grid 类内部已经处理了滚动位置的保存和恢复
        // 不需要额外的滚动位置处理
    }
}

/**
 * TreeCheckboxHeaderRenderer - 用于树形表格的表头复选框渲染器
 * 
 * 特性：
 * 1. 考虑树形结构中的半选状态
 * 2. 更准确的全选/半选状态计算
 */
export class TreeCheckboxHeaderRenderer implements CellComponent {
    private params: any;
    private element!: HTMLElement;
    private checkbox!: HTMLInputElement;

    constructor() {
        this.params = {};
    }

    init(params: any): void {
        this.params = params;
        this.element = document.createElement('div');
        this.element.className = 'grid-tree-checkbox-header';
        this.element.style.display = 'flex';
        this.element.style.alignItems = 'center';
        this.element.style.justifyContent = 'center';
        this.element.style.height = '100%';

        this.checkbox = document.createElement('input');
        this.checkbox.type = 'checkbox';
        this.checkbox.className = 'grid-tree-checkbox-header';
        
        this.updateCheckboxState();
        
        this.checkbox.addEventListener('click', this.onCheckboxClick.bind(this));
        this.checkbox.addEventListener('change', this.onCheckboxChange.bind(this));
        
        this.element.appendChild(this.checkbox);
    }

    getGui(): HTMLElement {
        return this.element;
    }

    refresh(): boolean {
        this.updateCheckboxState();
        return true;
    }

    destroy(): void {
        this.checkbox.removeEventListener('click', this.onCheckboxClick.bind(this));
        this.checkbox.removeEventListener('change', this.onCheckboxChange.bind(this));
    }

    /**
     * 更新表头复选框状态
     * 考虑了树形结构的所有节点和半选状态
     */
    private updateCheckboxState(): void {
        const api = this.params.api;
        if (!api) return;
        
        // 获取所有节点数量（包括非可见节点）
        let totalNodeCount = 0;
        let allNodes: any[] = [];
        api.forEachNode((node: any) => {
            totalNodeCount++;
            allNodes.push(node);
        });
        
        // 获取已选中节点和半选状态节点
        const selectedNodes = api.getSelectedNodes();
        const indeterminateNodes = api.getIndeterminateNodes ? api.getIndeterminateNodes() : [];
        
        // 如果没有节点，复选框为未选中状态
        if (totalNodeCount === 0) {
            this.checkbox.checked = false;
            this.checkbox.indeterminate = false;
            return;
        }
        
        // 如果所有节点都被选中，复选框为全选状态
        if (selectedNodes.length === totalNodeCount) {
            this.checkbox.checked = true;
            this.checkbox.indeterminate = false;
            return;
        }
        
        // 如果有选中节点或半选状态节点，复选框为半选状态
        if (selectedNodes.length > 0 || indeterminateNodes.length > 0) {
            this.checkbox.checked = false;
            this.checkbox.indeterminate = true;
            return;
        }
        
        // 默认情况：没有选中节点，复选框为未选中状态
        this.checkbox.checked = false;
        this.checkbox.indeterminate = false;
    }
    
    private onCheckboxClick(event: Event): void {
        // 阻止事件冒泡
        event.stopPropagation();
        
        // 不需要手动保存滚动位置，Grid 类内部会处理
    }

    private onCheckboxChange(event: Event): void {
        const api = this.params.api;
        if (!api) return;
        
        // 使用事件总线发布全选/取消全选事件
        if (this.checkbox.checked) {
            api.selectAll();
        } else {
            api.deselectAll();
        }
        
        // Grid 类内部已经处理了滚动位置的保存和恢复
        // 不需要额外的滚动位置处理
    }
} 