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
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 6H11V8H9V6Z" fill="#888888"/>
                <path d="M13 6H15V8H13V6Z" fill="#888888"/>
                <path d="M9 11H11V13H9V11Z" fill="#888888"/>
                <path d="M13 11H15V13H13V11Z" fill="#888888"/>
                <path d="M9 16H11V18H9V16Z" fill="#888888"/>
                <path d="M13 16H15V18H13V16Z" fill="#888888"/>
            </svg>
        `;
        
        // 添加悬停效果和过渡动画的样式
        const style = document.createElement('style');
        style.textContent = `
            .grid-row-drag-handle {
                cursor: grab;
                opacity: 0.6;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100%;
            }
            .grid-row-drag-handle:hover {
                opacity: 1;
                transform: scale(1.1);
            }
            .grid-row-drag-handle:active {
                cursor: grabbing;
            }
        `;
        document.head.appendChild(style);
        
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