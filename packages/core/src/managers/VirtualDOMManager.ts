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
    // 存储每个元素绑定的事件处理函数，用于清理
    private elementEventHandlers: Map<string, Map<string, EventListener>> = new Map();

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
            // 初始化该元素的事件处理器映射
            this.elementEventHandlers.set(id, new Map());
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
            // 获取该元素已有的事件处理器映射
            let eventHandlers = this.elementEventHandlers.get(id);
            if (!eventHandlers) {
                eventHandlers = new Map();
                this.elementEventHandlers.set(id, eventHandlers);
            }
            
            // 清除并重新绑定事件
            Object.entries(updates.events).forEach(([eventName, listener]) => {
                if (listener) {
                    // 先移除旧的监听器
                    const oldListener = eventHandlers!.get(eventName);
                    if (oldListener) {
                        element.removeEventListener(eventName, oldListener);
                    }
                    
                    // 添加新的监听器
                    element.addEventListener(eventName, listener as EventListener);
                    // 保存新的监听器
                    eventHandlers!.set(eventName, listener as EventListener);
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
                const existingElement = element.querySelector(`[data-element-id="${id}"]`);
                if (existingElement) {
                    // 如果元素已存在，替换它
                    existingElement.parentElement?.replaceChild(element, existingElement);
                } else {
                    // 如果元素不存在，我们需要找到它的父元素
                    const parentId = Array.from(this.virtualElements.entries())
                        .find(([_, el]) => el.contains(element))?.[0];
                    
                    if (parentId) {
                        const parent = element.querySelector(`[data-element-id="${parentId}"]`);
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
            // 清除所有事件监听器
            this.clearElementEventListeners(id);
            
            element.remove();
            this.virtualElements.delete(id);
            this.elementEventHandlers.delete(id);
        }
    }

    /**
     * 清除元素的所有事件监听器
     */
    private clearElementEventListeners(id: string) {
        const element = this.virtualElements.get(id);
        const handlers = this.elementEventHandlers.get(id);
        
        if (element && handlers) {
            handlers.forEach((listener, eventName) => {
                element.removeEventListener(eventName, listener);
            });
            handlers.clear();
        }
    }

    clear() {
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
        }
        
        // 清除所有元素的事件监听器
        this.elementEventHandlers.forEach((handlers, id) => {
            this.clearElementEventListeners(id);
        });
        
        this.virtualElements.clear();
        this.elementEventHandlers.clear();
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

    /**
     * 获取元素列表，可用于调试
     * @param idPattern 可选的ID正则模式
     * @returns 匹配的元素ID列表
     */
    getElementIds(idPattern?: RegExp): string[] {
        if (!idPattern) {
            return Array.from(this.virtualElements.keys());
        }
        
        return Array.from(this.virtualElements.keys()).filter(id => idPattern.test(id));
    }

    /**
     * 获取特定前缀的所有元素ID
     * @param prefix ID前缀
     * @returns 匹配前缀的元素ID列表
     */
    getElementsByPrefix(prefix: string): string[] {
        return Array.from(this.virtualElements.keys()).filter(id => id.startsWith(prefix));
    }

    /**
     * 获取特定后缀的所有元素ID
     * @param suffix ID后缀
     * @returns 匹配后缀的元素ID列表
     */
    getElementsBySuffix(suffix: string): string[] {
        return Array.from(this.virtualElements.keys()).filter(id => id.endsWith(suffix));
    }

    /**
     * 获取包含特定文本的所有元素ID
     * @param substring 子字符串
     * @returns 包含子字符串的元素ID列表
     */
    getElementsBySubstring(substring: string): string[] {
        return Array.from(this.virtualElements.keys()).filter(id => id.includes(substring));
    }
} 