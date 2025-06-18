// 事件句柄接口
interface EventHandler {
    handler: Function;
    source?: string; // 事件来源标识，用于调试
}

// 事件管理器
export class EventManager {
    // 使用Map存储事件名称到处理函数集合的映射
    private eventHandlers: Map<string, Set<EventHandler>> = new Map();
    // 跟踪注册的事件总数
    private handlerCount: number = 0;
    // 调试模式
    private debugMode: boolean = false;

    /**
     * 构造函数
     * @param debug 是否启用调试模式
     */
    constructor(debug: boolean = false) {
        this.debugMode = debug;
    }

    /**
     * 注册事件处理函数
     * @param eventName 事件名称
     * @param handler 处理函数
     * @param source 事件来源(可选)，用于调试
     * @returns 返回取消注册的函数
     */
    on(eventName: string, handler: Function, source?: string): () => void {
        if (!this.eventHandlers.has(eventName)) {
            this.eventHandlers.set(eventName, new Set());
        }
        
        const eventHandler: EventHandler = { 
            handler, 
            source: source || 'unknown' 
        };
        
        this.eventHandlers.get(eventName)!.add(eventHandler);
        this.handlerCount++;
        
        if (this.debugMode) {
            console.log(`[EventManager] 注册事件: ${eventName}, 来源: ${eventHandler.source}, 当前总数: ${this.handlerCount}`);
        }
        
        // 返回取消注册的函数
        return () => this.off(eventName, handler);
    }

    /**
     * 取消注册事件处理函数
     * @param eventName 事件名称
     * @param handler 处理函数
     */
    off(eventName: string, handler: Function): void {
        const handlers = this.eventHandlers.get(eventName);
        if (handlers) {
            // 查找匹配的处理函数并移除
            handlers.forEach(eventHandler => {
                if (eventHandler.handler === handler) {
                    handlers.delete(eventHandler);
                    this.handlerCount--;
                    
                    if (this.debugMode) {
                        console.log(`[EventManager] 移除事件: ${eventName}, 来源: ${eventHandler.source}, 剩余总数: ${this.handlerCount}`);
                    }
                }
            });
            
            // 如果该事件没有处理函数了，移除整个事件项
            if (handlers.size === 0) {
                this.eventHandlers.delete(eventName);
            }
        }
    }

    /**
     * 触发事件
     * @param eventName 事件名称
     * @param args 事件参数
     */
    emit(eventName: string, ...args: any[]): void {
        const handlers = this.eventHandlers.get(eventName);
        if (handlers && handlers.size > 0) {
            if (this.debugMode) {
                console.log(`[EventManager] 触发事件: ${eventName}, 处理函数数量: ${handlers.size}`);
            }
            
            handlers.forEach(eventHandler => {
                try {
                    eventHandler.handler(...args);
                } catch (error) {
                    console.error(`[EventManager] 事件处理异常: ${eventName}, 来源: ${eventHandler.source}`, error);
                }
            });
        }
    }

    /**
     * 清除所有事件处理函数
     */
    clear(): void {
        const oldCount = this.handlerCount;
        this.eventHandlers.clear();
        this.handlerCount = 0;
        
        if (this.debugMode) {
            console.log(`[EventManager] 清除所有事件处理函数, 清除数量: ${oldCount}`);
        }
    }

    /**
     * 设置调试模式
     * @param enabled 是否启用
     */
    setDebugMode(enabled: boolean): void {
        this.debugMode = enabled;
    }

    /**
     * 获取已注册的事件处理函数数量
     */
    getHandlerCount(): number {
        return this.handlerCount;
    }

    /**
     * 获取事件统计信息
     * @returns 事件统计信息对象
     */
    getStats(): { [eventName: string]: number } {
        const stats: { [eventName: string]: number } = {};
        
        this.eventHandlers.forEach((handlers, eventName) => {
            stats[eventName] = handlers.size;
        });
        
        return stats;
    }
} 