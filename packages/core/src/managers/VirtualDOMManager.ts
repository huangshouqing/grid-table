import { Grid } from "../grid";
import { Column } from "../types";

// 添加事件类型定义
interface DOMEvents {
    click: MouseEvent;
    mousedown: MouseEvent;
    mousemove: MouseEvent;
    mouseup: MouseEvent;
    dragstart: DragEvent;
    dragover: DragEvent;
    drop: DragEvent;
    dragend: DragEvent;
    dblclick: MouseEvent;  // 添加双击事件类型
}

type EventHandler<T extends Event> = (e: T) => void;
type EventHandlers = {
    [K in keyof DOMEvents]?: EventHandler<DOMEvents[K]>;
};

// DOM 抽象层
export class VirtualDOMManager {
    private virtualElements: Map<string, HTMLElement> = new Map();
    private domUpdateQueue: Set<string> = new Set();
    private rafId: number | null = null;

    constructor(private grid: Grid) {}

    createElement(id: string, tag: string, className?: string): HTMLElement {
        let element = this.virtualElements.get(id);
        if (!element) {
            element = document.createElement(tag);
            if (className) {
                element.className = className;
            }
            element.setAttribute('data-element-id', id);
            this.virtualElements.set(id, element);
        }
        return element;
    }

    getElement(id: string): HTMLElement | null {
        return this.virtualElements.get(id) || null;
    }

    appendChild(parentId: string, childId: string): void {
        const parent = this.virtualElements.get(parentId);
        const child = this.virtualElements.get(childId);
        if (parent && child) {
            try {
                // 确保子元素有 data-element-id
                child.setAttribute('data-element-id', childId);
                parent.appendChild(child);
                this.scheduleUpdate(parentId);
            } catch (error) {
                console.error(`Failed to append child ${childId} to parent ${parentId}:`, error);
            }
        }
    }

    updateElement(id: string, updates: {
        attributes?: Record<string, string>;
        styles?: Partial<CSSStyleDeclaration>;
        content?: string | HTMLElement;
        events?: EventHandlers;
        classes?: string[];
    }) {
        const element = this.virtualElements.get(id);
        if (!element) return;

        if (updates.attributes) {
            Object.entries(updates.attributes).forEach(([key, value]) => {
                element.setAttribute(key, value);
            });
        }

        if (updates.styles) {
            Object.assign(element.style, updates.styles);
        }

        if (updates.content) {
            if (typeof updates.content === 'string') {
                element.innerHTML = updates.content;
            } else {
                element.innerHTML = '';
                element.appendChild(updates.content);
            }
        }

        if (updates.events) {
            Object.entries(updates.events).forEach(([event, listener]) => {
                if (listener) {
                    element.addEventListener(event, listener as EventListener);
                }
            });
        }

        if (updates.classes) {
            element.classList.add(...updates.classes);
        }

        this.scheduleUpdate(id);
    }

    private scheduleUpdate(id: string) {
        this.domUpdateQueue.add(id);
        
        if (!this.rafId) {
            this.rafId = requestAnimationFrame(() => {
                this.flushUpdates();
            });
        }
    }

    private flushUpdates() {
        this.domUpdateQueue.forEach(id => {
            const element = this.virtualElements.get(id);
            if (element) {
                // 检查元素是否已经在 DOM 中
                const existingElement = document.querySelector(`[data-element-id="${id}"]`);
                if (existingElement) {
                    // 如果元素已存在，替换它
                    existingElement.parentElement?.replaceChild(element, existingElement);
                } else {
                    // 如果元素不存在，我们需要找到它的父元素
                    const parentId = Array.from(this.virtualElements.entries())
                        .find(([_, el]) => el.contains(element))?.[0];
                    
                    if (parentId) {
                        const parent = document.querySelector(`[data-element-id="${parentId}"]`);
                        if (parent) {
                            parent.appendChild(element);
                        }
                    }
                }
            }
        });

        this.domUpdateQueue.clear();
        this.rafId = null;
    }

    removeElement(id: string) {
        const element = this.virtualElements.get(id);
        if (element) {
            element.remove();
            this.virtualElements.delete(id);
        }
    }

    clear() {
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
        }
        this.virtualElements.clear();
        this.domUpdateQueue.clear();
    }

    batchUpdateRows(updatedRows: Map<string | number, any>) {
        this.grid.batchUpdateRows(updatedRows);
    }

    updateColumnOrder(columns: Column[]) {
        // 获取所有行元素
        const rowElements = Array.from(this.virtualElements.entries())
            .filter(([id]) => id.startsWith('row-'))
            .map(([_, element]) => element);

        // 更新每行的单元格顺序
        rowElements.forEach(row => {
            const cells = Array.from(row.children);
            
            // 移除所有单元格
            cells.forEach(cell => {
                row.removeChild(cell);
            });

            const rowId = row.getAttribute('data-element-id')?.replace('row-', '');
            if (!rowId) return;

            // 按新顺序重新添加单元格
            columns.forEach(column => {
                const cellId = `cell-${rowId}-${column.field}`;
                const cell = this.virtualElements.get(cellId);
                if (cell) {
                    row.appendChild(cell);
                }
            });
        });

        // 触发更新
        this.flushUpdates();
    }
} 