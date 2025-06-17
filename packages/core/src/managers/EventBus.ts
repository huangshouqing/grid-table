/**
 * EventBus - 事件总线
 * 简单的发布/订阅系统，用于组件与表格核心的通信
 */
export class EventBus {
  private subscribers: Map<string, Array<(payload: any) => void>> = new Map();
  
  /**
   * 订阅事件
   * @param eventName 事件名称
   * @param callback 回调函数
   * @returns 取消订阅的函数
   */
  subscribe(eventName: string, callback: (payload: any) => void): () => void {
    if (!this.subscribers.has(eventName)) {
      this.subscribers.set(eventName, []);
    }
    
    const callbacks = this.subscribers.get(eventName)!;
    callbacks.push(callback);
    
    // 返回取消订阅的函数
    return () => {
      this.unsubscribe(eventName, callback);
    };
  }
  
  /**
   * 发布事件
   * @param eventName 事件名称
   * @param payload 事件数据
   */
  publish(eventName: string, payload: any): void {
    if (!this.subscribers.has(eventName)) {
      return;
    }
    
    const callbacks = this.subscribers.get(eventName)!;
    callbacks.forEach(callback => {
      try {
        callback(payload);
      } catch (error) {
        console.error(`Error in EventBus subscriber for event "${eventName}":`, error);
      }
    });
  }
  
  /**
   * 取消订阅
   * @param eventName 事件名称
   * @param callback 回调函数
   */
  unsubscribe(eventName: string, callback: (payload: any) => void): void {
    if (!this.subscribers.has(eventName)) {
      return;
    }
    
    const callbacks = this.subscribers.get(eventName)!;
    const index = callbacks.indexOf(callback);
    if (index !== -1) {
      callbacks.splice(index, 1);
    }
    
    // 如果没有更多的订阅者，则删除事件
    if (callbacks.length === 0) {
      this.subscribers.delete(eventName);
    }
  }
  
  /**
   * 清除所有订阅
   */
  clear(): void {
    this.subscribers.clear();
  }
} 