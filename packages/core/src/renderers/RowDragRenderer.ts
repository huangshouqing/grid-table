import { CellComponent, ComponentParams } from '../types';

export class RowDragRenderer implements CellComponent {
    private params!: ComponentParams;
    private element!: HTMLElement;
    private dragHandle!: HTMLElement;

    init(params: ComponentParams): void {
        this.params = params;
        this.element = document.createElement('div');
        this.element.className = 'grid-row-drag-cell';
        this.element.style.display = 'flex';
        this.element.style.alignItems = 'center';
        this.element.style.justifyContent = 'center';
        this.element.style.height = '100%';
        this.element.style.cursor = 'move';

        this.dragHandle = document.createElement('div');
        this.dragHandle.className = 'grid-row-drag-handle';
        this.dragHandle.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 6H10V8H8V6Z" fill="currentColor"/>
                <path d="M14 6H16V8H14V6Z" fill="currentColor"/>
                <path d="M8 10H10V12H8V10Z" fill="currentColor"/>
                <path d="M14 10H16V12H14V10Z" fill="currentColor"/>
                <path d="M8 14H10V16H8V14Z" fill="currentColor"/>
                <path d="M14 14H16V16H14V14Z" fill="currentColor"/>
            </svg>
        `;
        
        this.element.appendChild(this.dragHandle);
        
        // 设置拖拽相关属性
        this.element.setAttribute('draggable', 'true');
        this.element.addEventListener('dragstart', this.onDragStart);
    }

    getGui(): HTMLElement {
        return this.element;
    }

    refresh(params: ComponentParams): boolean {
        this.params = params;
        return true;
    }

    destroy(): void {
        this.element.removeEventListener('dragstart', this.onDragStart);
    }

    private onDragStart = (event: DragEvent): void => {
        if (!event.dataTransfer) return;
        
        const rowNode = this.params.node;
        const rowElement = this.element.closest('.grid-row') as HTMLElement;
        
        if (!rowElement) return;
        
        // 设置拖拽数据
        const rowData = {
            rowId: rowNode.id,
            rowIndex: rowNode.rowIndex,
            isRowDrag: true  // 明确标记这是行拖拽
        };
        
        // 设置应用自定义类型，确保可以识别行拖拽
        event.dataTransfer.setData('application/grid-row', JSON.stringify(rowData));
        // 同时设置通用JSON数据，以兼容旧代码
        event.dataTransfer.setData('application/json', JSON.stringify(rowData));
        
        // 设置拖拽效果
        event.dataTransfer.effectAllowed = 'move';
        
        // 添加拖拽样式
        rowElement.classList.add('grid-row-dragging');
        
        // 创建自定义拖拽图像
        const dragImage = rowElement.cloneNode(true) as HTMLElement;
        dragImage.style.width = `${rowElement.offsetWidth}px`;
        dragImage.style.height = `${rowElement.offsetHeight}px`;
        dragImage.style.opacity = '0.7';
        dragImage.style.position = 'absolute';
        dragImage.style.top = '-1000px';
        dragImage.style.left = '-1000px';
        document.body.appendChild(dragImage);
        
        // 设置拖拽图像
        event.dataTransfer.setDragImage(dragImage, 0, 0);
        
        // 延迟移除拖拽图像
        setTimeout(() => {
            document.body.removeChild(dragImage);
        }, 0);
    }
} 