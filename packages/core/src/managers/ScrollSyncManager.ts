import { GridOptions } from '../types';

// 添加类型定义
type TimeoutHandle = ReturnType<typeof setTimeout>;

interface ScrollPosition {
    left: number;
    top: number;
}

// 添加滚动同步管理器类
export class ScrollSyncManager {
    private elementsToSync: {
        vertical: HTMLElement[],
        horizontal: HTMLElement[]
    } = { vertical: [], horizontal: [] };
    
    private primaryScrollElement: HTMLElement | null = null;
    private isSyncing: boolean = false;
    private animationFrameId: number | null = null;
    
    constructor() {}

    public register(elements: {
        bodies: HTMLElement[],
        centerHeader: HTMLElement,
        centerBody: HTMLElement,
    }) {
        this.unregister(); // 清理旧的监听器

        this.elementsToSync.vertical = [...elements.bodies];
        this.elementsToSync.horizontal = [elements.centerHeader, elements.centerBody];
        this.primaryScrollElement = elements.centerBody;

        if (this.primaryScrollElement) {
            this.primaryScrollElement.addEventListener('scroll', this.handlePrimaryScroll, { passive: true });
        }
    }

    private handlePrimaryScroll = () => {
        if (this.isSyncing) {
            return;
        }

        if (this.animationFrameId) {
            window.cancelAnimationFrame(this.animationFrameId);
        }

        this.animationFrameId = window.requestAnimationFrame(() => {
            this.syncScrollPositions();
            this.animationFrameId = null;
        });
    }

    private syncScrollPositions() {
        if (!this.primaryScrollElement) return;

        this.isSyncing = true;
        
        const { scrollTop, scrollLeft } = this.primaryScrollElement;

        // 同步垂直滚动
        this.elementsToSync.vertical.forEach(el => {
            if (el !== this.primaryScrollElement && el.scrollTop !== scrollTop) {
                el.scrollTop = scrollTop;
            }
        });

        // 同步水平滚动
        this.elementsToSync.horizontal.forEach(el => {
            if (el !== this.primaryScrollElement && el.scrollLeft !== scrollLeft) {
                el.scrollLeft = scrollLeft;
            }
        });
        
        // 使用 microtask (Promise.resolve) 确保同步标志在下一轮事件循环前被重置
        Promise.resolve().then(() => {
            this.isSyncing = false;
        });
    }

    public unregister() {
        if (this.primaryScrollElement) {
            this.primaryScrollElement.removeEventListener('scroll', this.handlePrimaryScroll);
        }
        if (this.animationFrameId) {
            window.cancelAnimationFrame(this.animationFrameId);
        }
        this.elementsToSync = { vertical: [], horizontal: [] };
        this.primaryScrollElement = null;
    }

    public destroy() {
        this.unregister();
    }
} 