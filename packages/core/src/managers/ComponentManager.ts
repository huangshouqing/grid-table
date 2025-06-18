import { Column } from '../types/index';
import { IComponent, IComponentParams, ComponentDefinition } from '../interface/components';
import { EventBus } from '../eventbus/EventBus';

// 组件构造函数类型
type ComponentConstructor = new () => IComponent;

// 组件工厂函数类型
type ComponentFactory = (params: IComponentParams) => HTMLElement;

// 单例组件构造函数的特殊接口类型
interface SingletonComponentClass {
  getInstance(): IComponent;
}

// 组件实例映射
interface ComponentInstance {
  instance: IComponent | HTMLElement;
  element: HTMLElement;
}

// 添加到类的开头
export interface ComponentManagerOptions {
  /**
   * 是否允许多个编辑组件同时存在
   * 默认为false，表示同一时间只能存在一个编辑组件
   */
  allowMultipleEditors?: boolean;
}

export class ComponentManager {
  // 组件注册表
  private componentRegistry: Map<string, ComponentDefinition> = new Map();
  
  // 已创建的组件实例
  private components: Map<string, ComponentInstance> = new Map();
  
  // 组件池 - 用于复用不可见的组件实例
  private componentPool: Map<string, IComponent[]> = new Map();
  
  // 事件总线
  private eventBus: EventBus;
  
  // 当前活动的编辑组件ID
  private activeEditorId: string | null = null;
  
  // 配置选项
  private options: ComponentManagerOptions;
  
  constructor(eventBus: EventBus, options: ComponentManagerOptions = {}) {
    this.eventBus = eventBus;
    this.options = {
      allowMultipleEditors: false,
      ...options
    };
    
    // 初始化默认组件
    this.registerDefaultComponents();
  }
  
  // 注册默认组件
  private registerDefaultComponents() {
    // 可以在这里注册一些默认组件
  }
  
  /**
   * 注册单个自定义组件
   * @param type 组件类型标识
   * @param definition 组件定义
   */
  registerComponent(type: string, definition: ComponentDefinition): void {
    this.componentRegistry.set(type, definition);
  }

  /**
   * 批量注册自定义组件
   * @param components 组件映射对象
   */
  registerComponents(components: Record<string, ComponentDefinition>): void {
    Object.entries(components).forEach(([type, definition]) => {
      this.registerComponent(type, definition);
    });
  }
  
  /**
   * 获取组件定义
   * @param type 组件类型标识
   */
  getComponentDefinition(type: string): ComponentDefinition | undefined {
    return this.componentRegistry.get(type);
  }
  
  /**
   * 创建视图组件
   * @param id 组件ID
   * @param column 列定义
   * @param params 组件参数
   * @returns 组件的DOM元素
   */
  createViewComponent(id: string, column: Column, params: IComponentParams): HTMLElement {
    // 销毁之前的组件实例
    this.destroyComponent(id);
    
    // 检查是否有自定义组件定义
    if (column.cellComponent?.type) {
      const componentDef = this.getComponentDefinition(column.cellComponent.type);
      if (componentDef && componentDef.view) {
        // 合并组件属性到参数中
        const componentParams: IComponentParams = {
          ...params,
          props: column.cellComponent.props,
          colDef: column,
          eventBus: this.eventBus
        };
        
        // 创建组件
        return this.createComponentInstance(id, componentDef.view, componentParams, 'view');
      }
    }
    
    // 使用列定义的渲染器
    if (column.cellRenderer) {
      if (typeof column.cellRenderer === 'function') {
        // 函数渲染器
        const element = column.cellRenderer(params as any);
        this.components.set(id, { instance: element, element });
        return element;
      } else if (typeof column.cellRenderer === 'object') {
        if ('new' in column.cellRenderer) {
          // 类组件
          const ComponentClass = column.cellRenderer as unknown as ComponentConstructor;
          const instance = this.createClassComponent(ComponentClass, params);
          this.components.set(id, { instance, element: instance.getGui() });
          return instance.getGui();
        } else if ('view' in column.cellRenderer) {
          // 对象定义的视图渲染器
          const viewRenderer = column.cellRenderer.view;
          if (typeof viewRenderer === 'function' && !this.isComponentConstructor(viewRenderer)) {
            // 函数渲染器
            const element = viewRenderer(params as any);
            this.components.set(id, { instance: element, element });
            return element;
          } else {
            // 类组件
            const ComponentClass = viewRenderer as unknown as ComponentConstructor;
            const instance = this.createClassComponent(ComponentClass, params);
            this.components.set(id, { instance, element: instance.getGui() });
            return instance.getGui();
          }
        }
      }
    }
    
    // 默认渲染
    const defaultElement = document.createElement('div');
    defaultElement.textContent = params.value !== undefined && params.value !== null 
        ? String(params.value) 
        : '';
    this.components.set(id, { instance: defaultElement, element: defaultElement });
    return defaultElement;
  }
  
  /**
   * 创建编辑组件
   * @param id 组件ID
   * @param column 列定义
   * @param params 组件参数
   * @returns 组件的DOM元素
   */
  createEditComponent(id: string, column: Column, params: IComponentParams): HTMLElement {
    // 如果不允许多个编辑组件同时存在，销毁当前活动的编辑组件
    if (!this.options.allowMultipleEditors && this.activeEditorId && this.activeEditorId !== id) {
      this.destroyComponent(this.activeEditorId);
    }
    
    // 记录当前编辑组件ID
    this.activeEditorId = id;
    
    // 销毁之前的组件实例
    this.destroyComponent(id);
    
    // 检查是否有自定义组件定义
    if (column.cellComponent?.type) {
      const componentDef = this.getComponentDefinition(column.cellComponent.type);
      if (componentDef && componentDef.edit) {
        // 合并组件属性到参数中
        const componentParams: IComponentParams = {
          ...params,
          props: column.cellComponent.props,
          colDef: column,
          eventBus: this.eventBus
        };
        
        // 创建编辑组件
        const element = this.createComponentInstance(id, componentDef.edit, componentParams, 'edit');
        
        // 确保编辑组件有正确的事件处理
        this.ensureEditComponentEvents(element, params);
        
        return element;
      }
    }
    
    // 使用列定义的编辑渲染器
    if (column.cellRenderer && typeof column.cellRenderer === 'object' && 'edit' in column.cellRenderer && column.cellRenderer.edit) {
      const editRenderer = column.cellRenderer.edit;
      
      // 检查是否是单例组件类
      if (typeof editRenderer === 'function' && 
          'getInstance' in editRenderer && 
          typeof (editRenderer as any).getInstance === 'function') {
        
        // 使用单例模式获取实例
        const singletonClass = editRenderer as unknown as SingletonComponentClass;
        const instance = singletonClass.getInstance();
        
        // 初始化并记录组件实例
        instance.init(params);
        const element = instance.getGui();
        this.components.set(id, { instance, element });
        
        // 确保编辑组件有正确的事件处理
        this.ensureEditComponentEvents(element, params);
        
        console.log(`[ComponentManager] Using singleton instance for edit component ${id}`);
        return element;
      }
      else if (typeof editRenderer === 'function' && !this.isComponentConstructor(editRenderer)) {
        // 函数渲染器
        const element = editRenderer(params as any);
        this.components.set(id, { instance: element, element });
        
        // 确保编辑组件有正确的事件处理
        this.ensureEditComponentEvents(element, params);
        
        return element;
      } else {
        // 常规类组件
        const ComponentClass = editRenderer as unknown as ComponentConstructor;
        const instance = this.createClassComponent(ComponentClass, params);
        const element = instance.getGui();
        this.components.set(id, { instance, element });
        
        // 确保编辑组件有正确的事件处理
        this.ensureEditComponentEvents(element, params);
        
        return element;
      }
    }
    
    // 默认编辑组件
    const input = document.createElement('input');
    input.type = 'text';
    input.value = params.value !== undefined && params.value !== null ? String(params.value) : '';
    input.className = 'grid-cell-editor';
    input.style.width = '100%';
    input.style.height = '100%';
    input.style.boxSizing = 'border-box';
    input.style.border = 'none';
    input.style.padding = '4px';
    input.style.outline = 'none';
    
    // 添加键盘事件
    input.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' && params.onComplete) {
        params.onComplete(input.value);
      } else if (e.key === 'Escape' && params.onCancel) {
        params.onCancel();
      }
    });
    
    this.components.set(id, { instance: input, element: input });
    return input;
  }
  
  /**
   * 确保编辑组件有正确的事件处理
   * @param element 编辑组件元素
   * @param params 组件参数
   */
  private ensureEditComponentEvents(element: HTMLElement, params: IComponentParams): void {
    // 如果组件是输入元素，确保它有键盘事件处理
    const inputElements = element.querySelectorAll('input, select, textarea');
    if (inputElements.length > 0) {
      inputElements.forEach(input => {
        // 避免重复添加事件
        if (!(input as any).__hasEditEvents) {
          input.addEventListener('keydown', ((e: Event) => {
            const keyEvent = e as KeyboardEvent;
            if (keyEvent.key === 'Enter' && params.onComplete) {
              params.onComplete((input as HTMLInputElement).value);
            } else if (keyEvent.key === 'Escape' && params.onCancel) {
              params.onCancel();
            }
          }) as EventListener);
          
          // 标记已添加事件
          (input as any).__hasEditEvents = true;
        }
      });
    }
  }
  
  /**
   * 创建基于类的组件实例
   * @param ComponentClass 组件类
   * @param params 初始化参数
   * @returns IComponent 实例
   */
  private createClassComponent(ComponentClass: ComponentConstructor, params: IComponentParams): IComponent {
    // 尝试从组件池中获取实例
    const componentType = ComponentClass.name || 'anonymous';
    const pooledComponent = this.getComponentFromPool(componentType);
    
    if (pooledComponent) {
      // 复用组件实例
      pooledComponent.init(params);
      return pooledComponent;
    }
    
    // 创建新实例
    const instance = new ComponentClass();
    instance.init(params);
    return instance;
  }
  
  /**
   * 从组件池获取组件实例
   * @param componentType 组件类型
   * @returns 组件实例或undefined
   */
  private getComponentFromPool(componentType: string): IComponent | undefined {
    const pool = this.componentPool.get(componentType);
    if (pool && pool.length > 0) {
      return pool.pop();
    }
    return undefined;
  }
  
  /**
   * 将组件放入组件池
   * @param componentType 组件类型
   * @param component 组件实例
   */
  private addComponentToPool(componentType: string, component: IComponent): void {
    if (!this.componentPool.has(componentType)) {
      this.componentPool.set(componentType, []);
    }
    
    const pool = this.componentPool.get(componentType)!;
    
    // 限制池大小，避免内存泄漏
    const MAX_POOL_SIZE = 50;
    if (pool.length < MAX_POOL_SIZE) {
      pool.push(component);
    }
  }
  
  /**
   * 创建组件实例
   * @param id 组件ID
   * @param componentDef 组件定义
   * @param params 组件参数
   * @param componentType 组件类型 ('view' 或 'edit')
   * @returns 组件的DOM元素
   */
  private createComponentInstance(
    id: string, 
    componentDef: ComponentFactory | ComponentConstructor, 
    params: IComponentParams,
    componentType: 'view' | 'edit'
  ): HTMLElement {
    if (typeof componentDef === 'function' && !this.isComponentConstructor(componentDef)) {
      // 函数工厂
      const element = (componentDef as ComponentFactory)(params);
      this.components.set(id, { instance: element, element });
      return element;
    } else {
      // 类组件
      const ComponentClass = componentDef as unknown as ComponentConstructor;
      const instance = this.createClassComponent(ComponentClass, params);
      const element = instance.getGui();
      this.components.set(id, { instance, element });
      return element;
    }
  }
  
  /**
   * 判断一个函数是否为组件构造函数
   * @param func 待检测函数
   * @returns 是否为构造函数
   */
  private isComponentConstructor(func: Function): boolean {
    // 如果函数原型上有 getGui 方法，则认为是组件构造函数
    return func.prototype && typeof func.prototype.getGui === 'function';
  }
  
  /**
   * 刷新组件
   * @param id 组件ID
   * @param params 新的组件参数
   * @returns 是否成功刷新 (true: 刷新成功, false: 需要重建)
   */
  refreshComponent(id: string, params: IComponentParams): boolean {
    const componentInstance = this.components.get(id);
    if (!componentInstance) {
      return false;
    }
    
    const { instance } = componentInstance;
    
    // 检查组件是否实现了refresh方法
    if (typeof (instance as IComponent).refresh === 'function') {
      return (instance as IComponent).refresh(params);
    }
    
    // 如果没有实现refresh方法，则需要重建
    return false;
  }
  
  /**
   * 销毁组件
   * @param id 组件ID
   */
  destroyComponent(id: string): void {
    const componentInstance = this.components.get(id);
    if (!componentInstance) {
      return;
    }
    
    const { instance } = componentInstance;
    
    // 如果是类组件，调用destroy方法
    if (instance && typeof (instance as IComponent).destroy === 'function') {
      (instance as IComponent).destroy();
      
      // 将组件放入复用池
      if (instance.constructor && instance.constructor.name) {
        this.addComponentToPool(instance.constructor.name, instance as IComponent);
      }
    }
    
    // 如果是当前活动的编辑组件，清除引用
    if (id === this.activeEditorId) {
      this.activeEditorId = null;
    }
    
    this.components.delete(id);
  }
  
  /**
   * 销毁所有组件
   */
  destroyAllComponents(): void {
    for (const id of this.components.keys()) {
      this.destroyComponent(id);
    }
    
    this.components.clear();
  }
} 