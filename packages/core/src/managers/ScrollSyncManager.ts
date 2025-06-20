import { GridOptions } from '../types';

// 添加类型定义
type TimeoutHandle = ReturnType<typeof setTimeout>;
type AnimationFrameHandle = number;

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
    private rafId: AnimationFrameHandle | null = null;
    private lastScrollPosition: ScrollPosition = { left: 0, top: 0 };
    private scrollingElement: HTMLElement | null = null;
    
    constructor() {}

    public register(elements: {
        bodies: HTMLElement[],
        centerHeader: HTMLElement,
        centerBody: HTMLElement,
        leftPinnedBody?: HTMLElement,
        rightPinnedBody?: HTMLElement
    }) {
        this.unregister(); // 清理旧的监听器

        this.elementsToSync.vertical = [...elements.bodies];
        this.elementsToSync.horizontal = [elements.centerHeader];
        this.primaryScrollElement = elements.centerBody;

        // 给所有的body元素添加滚动事件监听
        elements.bodies.forEach(body => {
            // 使用passive: true提高滚动性能
            body.addEventListener('scroll', this.handleScroll, { passive: true });
            
            // 添加will-change提示浏览器优化
            body.style.willChange = 'scroll-position';
        });
    }

    private handleScroll = (event: Event) => {
        if (this.isSyncing) return;
        
        const target = event.target as HTMLElement;
        if (!target) return;
        
        this.isSyncing = true;
        this.scrollingElement = target;

        // 获取当前滚动位置
        this.lastScrollPosition = {
            left: target.scrollLeft,
            top: target.scrollTop
        };
        
        // 使用requestAnimationFrame优化性能
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
        }
        
        this.rafId = requestAnimationFrame(() => {
            this.syncScrollPositions();
            this.rafId = null;
            this.isSyncing = false;
        });
    }

    private syncScrollPositions() {
        if (!this.scrollingElement) return;
        
        const { left: scrollLeft, top: scrollTop } = this.lastScrollPosition;
        
        // 同步垂直滚动，使用对比避免不必要的设置
        this.elementsToSync.vertical.forEach(el => {
            if (el !== this.scrollingElement && Math.abs(el.scrollTop - scrollTop) > 0.5) {
                el.scrollTop = scrollTop;
            }
        });

        // 只有当源元素是主滚动元素(centerBody)时才同步水平滚动
        if (this.scrollingElement === this.primaryScrollElement) {
            this.elementsToSync.horizontal.forEach(el => {
                if (el !== this.scrollingElement && Math.abs(el.scrollLeft - scrollLeft) > 0.5) {
                    el.scrollLeft = scrollLeft;
                }
            });
        }
        
        this.scrollingElement = null;
    }

    public unregister() {
        // 移除所有滚动事件监听器
        this.elementsToSync.vertical.forEach(el => {
            el.removeEventListener('scroll', this.handleScroll);
            el.style.willChange = '';
        });
        
        // 取消可能的动画帧请求
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        
        this.elementsToSync = { vertical: [], horizontal: [] };
        this.primaryScrollElement = null;
        this.scrollingElement = null;
    }

    public destroy() {
        this.unregister();
    }
} 