import { GridOptions } from '../types';

// 添加类型定义
type TimeoutHandle = ReturnType<typeof setTimeout>;

interface ScrollPosition {
    left: number;
    top: number;
}

// 添加滚动同步管理器类
export class ScrollSyncManager {
    private scrollableElements: Map<string, HTMLElement> = new Map();
    private scrollListeners: Map<string, () => void> = new Map();
    private isScrolling: boolean = false;
    private scrollTimeout: TimeoutHandle | null = null;
    private lastScrollPosition: Map<string, ScrollPosition> = new Map();
    private rafId: number | null = null;

    constructor(private options: {
        onScroll?: (scrollLeft: number, scrollTop: number) => void;
        debounceTime?: number;
    } = {}) {}

    addScrollable(id: string, element: HTMLElement, config: {
        syncHorizontal?: boolean;
        syncVertical?: boolean;
        master?: boolean;
    } = {}) {
        this.scrollableElements.set(id, element);
        this.lastScrollPosition.set(id, { left: element.scrollLeft, top: element.scrollTop });

        const listener = () => {
            const currentPosition = {
                left: element.scrollLeft,
                top: element.scrollTop
            };

            const lastPosition = this.lastScrollPosition.get(id) || { left: 0, top: 0 };

            // 检查是否真的发生了滚动
            if (currentPosition.left === lastPosition.left && 
                currentPosition.top === lastPosition.top) {
                return;
            }

            // 更新最后的滚动位置
            this.lastScrollPosition.set(id, { ...currentPosition });

            // 使用 requestAnimationFrame 来优化性能
            if (this.rafId) {
                cancelAnimationFrame(this.rafId);
            }

            this.rafId = requestAnimationFrame(() => {
                // 同步其他元素的滚动位置
                this.scrollableElements.forEach((el, elId) => {
                    if (elId !== id) {
                        const shouldSyncHorizontal = config.syncHorizontal && 
                            el.scrollLeft !== currentPosition.left;
                        const shouldSyncVertical = config.syncVertical && 
                            el.scrollTop !== currentPosition.top;

                        if (shouldSyncHorizontal) {
                            el.scrollLeft = currentPosition.left;
                        }
                        if (shouldSyncVertical) {
                            el.scrollTop = currentPosition.top;
                        }
                    }
                });

                // 触发自定义滚动事件
                if (this.options.onScroll) {
                    this.options.onScroll(currentPosition.left, currentPosition.top);
                }

                this.rafId = null;
            });
        };

        this.scrollListeners.set(id, listener);
        element.addEventListener('scroll', listener, { passive: true });
    }

    removeScrollable(id: string) {
        const element = this.scrollableElements.get(id);
        const listener = this.scrollListeners.get(id);
        
        if (element && listener) {
            element.removeEventListener('scroll', listener);
            this.scrollableElements.delete(id);
            this.scrollListeners.delete(id);
            this.lastScrollPosition.delete(id);
        }
    }

    scrollTo(scrollLeft: number, scrollTop: number) {
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
        }

        this.rafId = requestAnimationFrame(() => {
            this.scrollableElements.forEach(element => {
                if (element.scrollLeft !== scrollLeft) {
                    element.scrollLeft = scrollLeft;
                }
                if (element.scrollTop !== scrollTop) {
                    element.scrollTop = scrollTop;
                }
            });
            this.rafId = null;
        });
    }

    destroy() {
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
        }

        this.scrollableElements.forEach((element, id) => {
            const listener = this.scrollListeners.get(id);
            if (listener) {
                element.removeEventListener('scroll', listener);
            }
        });

        this.scrollableElements.clear();
        this.scrollListeners.clear();
        this.lastScrollPosition.clear();
    }
} 