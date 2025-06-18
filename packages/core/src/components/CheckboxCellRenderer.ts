import { CellRendererParams, CellComponent, ComponentParams } from '../types';

export class CheckboxCellRenderer implements CellComponent {
    private params!: ComponentParams;
    private element!: HTMLElement;
    private checkbox!: HTMLInputElement;

    init(params: ComponentParams): void {
        this.params = params;
        this.element = document.createElement('div');
        this.element.className = 'grid-checkbox-cell';
        this.element.style.display = 'flex';
        this.element.style.alignItems = 'center';
        this.element.style.justifyContent = 'center';
        this.element.style.height = '100%';

        this.checkbox = document.createElement('input');
        this.checkbox.type = 'checkbox';
        this.checkbox.className = 'grid-checkbox';
        this.checkbox.checked = this.params.node.selected;
        
        this.checkbox.addEventListener('click', this.onCheckboxClick);
        this.checkbox.addEventListener('change', this.onCheckboxChange);
        
        this.element.appendChild(this.checkbox);
    }

    getGui(): HTMLElement {
        return this.element;
    }

    refresh(params: ComponentParams): boolean {
        this.params = params;
        this.checkbox.checked = this.params.node.selected;
        return true;
    }

    destroy(): void {
        this.checkbox.removeEventListener('click', this.onCheckboxClick);
        this.checkbox.removeEventListener('change', this.onCheckboxChange);
    }

    private onCheckboxClick = (event: MouseEvent): void => {
        // 阻止事件冒泡，避免触发行选择
        event.stopPropagation();
    }

    private onCheckboxChange = (event: Event): void => {
        const checked = this.checkbox.checked;
        const api = this.params.api;
        const node = this.params.node;
        
        if (checked) {
            api.selectRow(node.id, false); // 不清除其他选择
        } else {
            // 取消选择当前行
            const selectedNodes = api.getSelectedNodes();
            api.deselectAll();
            
            // 重新选择除当前行外的所有已选行
            selectedNodes.forEach(selectedNode => {
                if (selectedNode.id !== node.id) {
                    api.selectRow(selectedNode.id, false);
                }
            });
        }
    }
}

// 创建表头复选框渲染器
export class CheckboxHeaderRenderer implements CellComponent {
    private params: any;
    private element!: HTMLElement;
    private checkbox!: HTMLInputElement;

    constructor() {
        this.params = {};
    }

    init(params: any): void {
        this.params = params;
        this.element = document.createElement('div');
        this.element.className = 'grid-checkbox-header';
        this.element.style.display = 'flex';
        this.element.style.alignItems = 'center';
        this.element.style.justifyContent = 'center';
        this.element.style.height = '100%';

        this.checkbox = document.createElement('input');
        this.checkbox.type = 'checkbox';
        this.checkbox.className = 'grid-checkbox';
        
        this.updateCheckboxState();
        
        this.checkbox.addEventListener('click', this.onCheckboxClick);
        this.checkbox.addEventListener('change', this.onCheckboxChange);
        
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
        this.checkbox.removeEventListener('click', this.onCheckboxClick);
        this.checkbox.removeEventListener('change', this.onCheckboxChange);
    }

    private updateCheckboxState(): void {
        const api = this.params.api;
        const selectedNodes = api.getSelectedNodes();
        const rowCount = api.getDisplayedRowCount();
        
        if (selectedNodes.length === 0) {
            this.checkbox.checked = false;
            this.checkbox.indeterminate = false;
        } else if (selectedNodes.length === rowCount) {
            this.checkbox.checked = true;
            this.checkbox.indeterminate = false;
        } else {
            this.checkbox.checked = false;
            this.checkbox.indeterminate = true;
        }
    }

    private onCheckboxClick = (event: MouseEvent): void => {
        // 阻止事件冒泡
        event.stopPropagation();
    }

    private onCheckboxChange = (): void => {
        const api = this.params.api;
        
        if (this.checkbox.checked) {
            api.selectAll();
        } else {
            api.deselectAll();
        }
    }
} 