import { CellComponent, ComponentParams, Column } from '../types/index';

// 组件构造函数类型
type ComponentConstructor = new () => CellComponent;

// 组件工厂函数类型
type ComponentFactory = (params: ComponentParams) => HTMLElement;

// 组件定义类型
interface ComponentDefinition {
    view: ComponentFactory | ComponentConstructor;
    edit?: ComponentFactory | ComponentConstructor;
}

export class ComponentManager {
    // 组件注册表
    private componentRegistry: Map<string, ComponentDefinition> = new Map();
    
    // 已创建的组件实例
    private components: Map<string, HTMLElement | CellComponent> = new Map();
    
    constructor() {
        // 初始化默认组件
        this.registerDefaultComponents();
    }
    
    // 注册默认组件
    private registerDefaultComponents() {
        // 可以在这里注册一些默认组件
    }
    
    /**
     * 注册自定义组件
     * @param type 组件类型标识
     * @param definition 组件定义
     */
    registerComponent(type: string, definition: ComponentDefinition): void {
        this.componentRegistry.set(type, definition);
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
     */
    createViewComponent(id: string, column: Column, params: ComponentParams): HTMLElement {
        // 销毁之前的组件实例
        this.destroyComponent(id);
        
        // 检查是否有自定义组件定义
        if (column.cellComponent?.type) {
            const componentDef = this.getComponentDefinition(column.cellComponent.type);
            if (componentDef) {
                // 合并组件属性到参数中
                const componentParams = {
                    ...params,
                    props: column.cellComponent.props
                };
                
                // 创建组件
                return this.createComponentInstance(id, componentDef.view, componentParams);
            }
        }
        
        // 使用列定义的渲染器
        if (column.cellRenderer) {
            if (typeof column.cellRenderer === 'function') {
                // 函数渲染器
                const element = column.cellRenderer(params);
                this.components.set(id, element);
                return element;
            } else if (typeof column.cellRenderer === 'object') {
                if ('new' in column.cellRenderer) {
                    // 类组件
                    const ComponentClass = column.cellRenderer as unknown as ComponentConstructor;
                    const instance = new ComponentClass();
                    if (instance.init) {
                        instance.init(params);
                    }
                    const element = instance.getGui();
                    this.components.set(id, instance);
                    return element;
                } else if ('view' in column.cellRenderer) {
                    // 对象定义的视图渲染器
                    const viewRenderer = column.cellRenderer.view;
                    if (typeof viewRenderer === 'function' && !this.isComponentConstructor(viewRenderer)) {
                        // 函数渲染器
                        const element = viewRenderer(params);
                        this.components.set(id, element);
                        return element;
                    } else {
                        // 类组件
                        const ComponentClass = viewRenderer as unknown as ComponentConstructor;
                        const instance = new ComponentClass();
                        if (instance.init) {
                            instance.init(params);
                        }
                        const element = instance.getGui();
                        this.components.set(id, instance);
                        return element;
                    }
                }
            }
        }
        
        // 默认渲染
        const defaultElement = document.createElement('div');
        defaultElement.textContent = params.value !== undefined && params.value !== null 
            ? String(params.value) 
            : '';
        this.components.set(id, defaultElement);
        return defaultElement;
    }
    
    /**
     * 创建编辑组件
     * @param id 组件ID
     * @param column 列定义
     * @param params 组件参数
     */
    createEditComponent(id: string, column: Column, params: ComponentParams): HTMLElement {
        // 销毁之前的组件实例
        this.destroyComponent(id);
        
        // 检查是否有自定义组件定义
        if (column.cellComponent?.type) {
            const componentDef = this.getComponentDefinition(column.cellComponent.type);
            if (componentDef && componentDef.edit) {
                // 合并组件属性到参数中
                const componentParams = {
                    ...params,
                    props: column.cellComponent.props
                };
                
                // 创建编辑组件
                const element = this.createComponentInstance(id, componentDef.edit, componentParams);
                
                // 确保编辑组件有正确的事件处理
                this.ensureEditComponentEvents(element, params);
                
                return element;
            }
        }
        
        // 使用列定义的编辑渲染器
        if (column.cellRenderer && typeof column.cellRenderer === 'object' && 'edit' in column.cellRenderer && column.cellRenderer.edit) {
            const editRenderer = column.cellRenderer.edit;
            if (typeof editRenderer === 'function' && !this.isComponentConstructor(editRenderer)) {
                // 函数渲染器
                const element = editRenderer(params);
                this.components.set(id, element);
                
                // 确保编辑组件有正确的事件处理
                this.ensureEditComponentEvents(element, params);
                
                return element;
            } else {
                // 类组件
                const ComponentClass = editRenderer as unknown as ComponentConstructor;
                const instance = new ComponentClass();
                if (instance.init) {
                    instance.init(params);
                }
                const element = instance.getGui();
                this.components.set(id, instance);
                
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
        
        this.components.set(id, input);
        return input;
    }
    
    /**
     * 确保编辑组件有正确的事件处理
     * @param element 编辑组件元素
     * @param params 组件参数
     */
    private ensureEditComponentEvents(element: HTMLElement, params: ComponentParams): void {
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
     * 创建组件实例
     * @param id 组件ID
     * @param componentDef 组件定义
     * @param params 组件参数
     */
    private createComponentInstance(id: string, componentDef: ComponentFactory | ComponentConstructor, params: ComponentParams): HTMLElement {
        if (typeof componentDef === 'function' && !this.isComponentConstructor(componentDef)) {
            // 函数工厂
            const element = (componentDef as ComponentFactory)(params);
            this.components.set(id, element);
            return element;
        } else {
            // 类组件
            const ComponentClass = componentDef as unknown as ComponentConstructor;
            const instance = new ComponentClass();
            if (instance.init) {
                instance.init(params);
            }
            const element = instance.getGui();
            this.components.set(id, instance);
            return element;
        }
    }
    
    /**
     * 判断是否为组件构造函数
     */
    private isComponentConstructor(func: Function): boolean {
        return 'prototype' in func && func.prototype && func.prototype.getGui;
    }
    
    /**
     * 销毁组件
     * @param id 组件ID
     */
    destroyComponent(id: string): void {
        const component = this.components.get(id);
        if (component) {
            if ('destroy' in component && typeof component.destroy === 'function') {
                component.destroy();
            }
            this.components.delete(id);
        }
    }
    
    /**
     * 销毁所有组件
     */
    destroyAllComponents(): void {
        this.components.forEach((component, id) => {
            this.destroyComponent(id);
        });
        this.components.clear();
    }
} 