import { CellComponent, ComponentParams } from '../types';

export class TreeCellRenderer implements CellComponent {
    private params!: ComponentParams;
    private element!: HTMLElement;
    private expandButton!: HTMLElement;
    private contentSpan!: HTMLSpanElement;

    init(params: ComponentParams): void {
        this.params = params;
        this.element = document.createElement('div');
        this.element.className = 'grid-tree-cell';
        this.element.style.display = 'flex';
        this.element.style.alignItems = 'center';
        this.element.style.height = '100%';
        
        // 创建缩进空间
        if (this.params.node.level && this.params.node.level > 0) {
            const indent = document.createElement('span');
            indent.className = 'grid-tree-indent';
            indent.style.width = `${this.params.node.level * 20}px`;
            this.element.appendChild(indent);
        }
        
        // 创建展开/折叠按钮
        this.expandButton = document.createElement('div');
        this.expandButton.className = 'grid-tree-expand-button';
        
        // 只有有子节点的行才显示展开/折叠按钮
        if (this.params.node.children && this.params.node.children.length > 0) {
            this.expandButton.innerHTML = this.params.node.expanded 
                ? '<svg width="16" height="16" viewBox="0 0 16 16"><path d="M3 8l5 5 5-5z"/></svg>' 
                : '<svg width="16" height="16" viewBox="0 0 16 16"><path d="M6 3l5 5-5 5z"/></svg>';
                
            this.expandButton.addEventListener('click', this.onExpandClick);
        } else {
            this.expandButton.style.visibility = 'hidden';
        }
        
        // 创建内容元素
        this.contentSpan = document.createElement('span');
        this.contentSpan.className = 'grid-tree-content';
        this.contentSpan.textContent = this.params.value !== undefined ? this.params.value.toString() : '';
        
        this.element.appendChild(this.expandButton);
        this.element.appendChild(this.contentSpan);
    }

    getGui(): HTMLElement {
        return this.element;
    }

    refresh(params: ComponentParams): boolean {
        this.params = params;
        
        // 更新展开/折叠按钮
        if (this.params.node.children && this.params.node.children.length > 0) {
            this.expandButton.innerHTML = this.params.node.expanded 
                ? '<svg width="16" height="16" viewBox="0 0 16 16"><path d="M3 8l5 5 5-5z"/></svg>' 
                : '<svg width="16" height="16" viewBox="0 0 16 16"><path d="M6 3l5 5-5 5z"/></svg>';
            this.expandButton.style.visibility = 'visible';
        } else {
            this.expandButton.style.visibility = 'hidden';
        }
        
        // 更新内容
        this.contentSpan.textContent = this.params.value !== undefined ? this.params.value.toString() : '';
        
        return true;
    }

    destroy(): void {
        this.expandButton.removeEventListener('click', this.onExpandClick);
    }

    private onExpandClick = (event: MouseEvent): void => {
        event.stopPropagation();
        
        const node = this.params.node;
        const api = this.params.api;
        
        // 切换展开状态
        node.expanded = !node.expanded;
        
        // 刷新视图
        api.refreshView();
    }
} 