import { Grid } from "../grid";

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
            this.virtualElements.set(id, element);
        }
        return element;
    }

    updateElement(id: string, updates: {
        attributes?: Record<string, string>;
        styles?: Partial<CSSStyleDeclaration>;
        content?: string | HTMLElement;
        events?: Record<string, EventListener>;
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
                element.textContent = updates.content;
            } else {
                element.innerHTML = '';
                element.appendChild(updates.content);
            }
        }

        if (updates.events) {
            Object.entries(updates.events).forEach(([event, listener]) => {
                element.addEventListener(event, listener);
            });
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
                // 实际的 DOM 更新
                const parent = element.parentElement;
                if (parent) {
                    const oldElement = parent.querySelector(`[data-element-id="${id}"]`);
                    if (oldElement) {
                        parent.replaceChild(element, oldElement);
                    } else {
                        parent.appendChild(element);
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
} 