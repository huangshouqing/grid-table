import { CellComponent, ComponentParams } from '../types';

/**
 * TreeCellRenderer - 专门为树形表格设计的内容渲染器
 * 
 * 特性：
 * 1. 支持展开/折叠功能
 * 2. 根据节点层级自动缩进
 * 3. 显示树形节点内容
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
        }
        
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
    }
    
    private onExpandClick(event: Event): void {
        event.stopPropagation();
        
        const node = this.params.node;
        
        // 切换展开状态
        node.expanded = !node.expanded;
        
        // 刷新视图
        this.params.api.refreshView();
    }
} 