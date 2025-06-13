// 事件管理器
export class EventManager {
    private eventHandlers: Map<string, Set<Function>> = new Map();

    on(eventName: string, handler: Function) {
        if (!this.eventHandlers.has(eventName)) {
            this.eventHandlers.set(eventName, new Set());
        }
        this.eventHandlers.get(eventName)!.add(handler);
    }

    off(eventName: string, handler: Function) {
        const handlers = this.eventHandlers.get(eventName);
        if (handlers) {
            handlers.delete(handler);
        }
    }

    emit(eventName: string, ...args: any[]) {
        const handlers = this.eventHandlers.get(eventName);
        if (handlers) {
            handlers.forEach(handler => handler(...args));
        }
    }

    clear() {
        this.eventHandlers.clear();
    }
} 