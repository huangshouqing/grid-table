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
        this.checkbox.addEventListener('click', (e: Event) => this.onCheckboxClick(e));
        this.checkbox.addEventListener('change', (e: Event) => this.onCheckboxChange(e));
        
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
        this.checkbox.removeEventListener('click', (e: Event) => this.onCheckboxClick(e));
        this.checkbox.removeEventListener('change', (e: Event) => this.onCheckboxChange(e));
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
        // 阻止事件冒泡，避免触发行选择
        event.stopPropagation();
    }

    private onCheckboxChange(event: Event): void {
        const api = this.params.api;
        const node = this.params.node;
        
        // 直接使用API切换节点选择状态
        api.toggleNodeSelection(node.id);
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
        
        this.checkbox.addEventListener('click', (e: Event) => this.onCheckboxClick(e));
        this.checkbox.addEventListener('change', (e: Event) => this.onCheckboxChange(e));
        
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
        this.checkbox.removeEventListener('click', (e: Event) => this.onCheckboxClick(e));
        this.checkbox.removeEventListener('change', (e: Event) => this.onCheckboxChange(e));
    }

    /**
     * 更新表头复选框状态
     * 考虑了树形结构的所有可见节点和半选状态
     */
    private updateCheckboxState(): void {
        const api = this.params.api;
        if (!api) return;
        
        // 获取所有可见节点和已选中节点
        const visibleNodes = api.getVisibleNodes();
        const selectedNodes = api.getSelectedNodes();
        
        // 获取半选状态的节点
        const indeterminateNodes = api.getIndeterminateNodes ? api.getIndeterminateNodes() : [];
        
        // 计算可见节点总数（不包括半选状态的节点）
        const visibleCount = visibleNodes.length;
        
        // 如果没有可见节点，复选框为未选中状态
        if (visibleCount === 0) {
            this.checkbox.checked = false;
            this.checkbox.indeterminate = false;
            return;
        }
        
        // 如果所有可见节点都被选中且没有半选状态节点，复选框为全选状态
        if (selectedNodes.length === visibleCount && indeterminateNodes.length === 0) {
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
    }
} 