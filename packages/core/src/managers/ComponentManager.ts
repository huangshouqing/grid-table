import { CellComponent, ComponentParams, Column } from '../types/index';

export class ComponentManager {
    private components: Map<string, CellComponent> = new Map();
    private componentElements: Map<string, HTMLElement> = new Map();

    /**
     * 创建视图组件（非编辑状态）
     */
    public createViewComponent(id: string, column: Column, params: ComponentParams): HTMLElement {
        // 先移除原组件（如果有）
        this.destroyComponent(id);

        let element: HTMLElement;
        
        // 处理各种渲染器类型
        if (column.cellRenderer) {
            if (typeof column.cellRenderer === 'function') {
                // 函数式渲染器
                element = this.createFunctionRenderer(id, column.cellRenderer, params);
            } else if (typeof column.cellRenderer === 'object') {
                if (column.cellRenderer.view) {
                    if (typeof column.cellRenderer.view === 'function') {
                        // 对象属性中的函数式视图渲染器
                        element = this.createFunctionRenderer(id, column.cellRenderer.view, params);
                    } else {
                        // 类组件视图渲染器
                        element = this.createClassComponent(id, column.cellRenderer.view, params);
                    }
                } else {
                    // 默认视图
                    element = this.createDefaultRenderer(params);
                }
            } else {
                element = this.createDefaultRenderer(params);
            }
        } else {
            element = this.createDefaultRenderer(params);
        }
        
        this.componentElements.set(id, element);
        return element;
    }

    /**
     * 创建编辑组件
     */
    public createEditComponent(id: string, column: Column, params: ComponentParams): HTMLElement {
        // 先移除原组件（如果有）
        this.destroyComponent(id);

        let element: HTMLElement;
        
        // 检查是否有编辑渲染器
        if (column.cellRenderer && typeof column.cellRenderer === 'object' && column.cellRenderer.edit) {
            if (typeof column.cellRenderer.edit === 'function') {
                // 函数式编辑渲染器
                element = this.createFunctionRenderer(id, column.cellRenderer.edit, params);
            } else {
                // 类组件编辑渲染器
                element = this.createClassComponent(id, column.cellRenderer.edit, params);
            }
        } else {
            // 默认编辑器
            element = this.createDefaultEditor(params);
        }
        
        this.componentElements.set(id, element);
        return element;
    }

    /**
     * 创建函数式渲染器
     */
    private createFunctionRenderer(id: string, renderer: Function, params: ComponentParams): HTMLElement {
        try {
            const result = renderer(params);
            
            if (result instanceof HTMLElement) {
                return result;
            } else if (typeof result === 'string') {
                const div = document.createElement('div');
                div.innerHTML = result;
                return div;
            } else {
                console.warn(`渲染器函数返回了无效的结果类型: ${typeof result}`);
                return document.createElement('div');
            }
        } catch (e) {
            console.error(`渲染器函数执行失败:`, e);
            const errorEl = document.createElement('div');
            errorEl.className = 'grid-cell-error';
            errorEl.textContent = '渲染错误';
            return errorEl;
        }
    }

    /**
     * 创建类组件
     */
    private createClassComponent(id: string, ComponentClass: new () => CellComponent, params: ComponentParams): HTMLElement {
        try {
            const instance = new ComponentClass();
            this.components.set(id, instance);
            
            // 初始化组件
            if (instance.init) {
                instance.init(params);
            }
            
            // 获取DOM元素
            const element = instance.getGui();
            
            // 组件挂载后回调
            setTimeout(() => {
                if (instance.afterGuiAttached) {
                    instance.afterGuiAttached();
                }
            }, 0);
            
            return element;
        } catch (e) {
            console.error(`组件类初始化失败:`, e);
            const errorEl = document.createElement('div');
            errorEl.className = 'grid-cell-error';
            errorEl.textContent = '组件错误';
            return errorEl;
        }
    }

    /**
     * 创建默认渲染器
     */
    private createDefaultRenderer(params: ComponentParams): HTMLElement {
        const div = document.createElement('div');
        div.className = 'grid-cell-default-view';
        
        const value = params.value !== undefined && params.value !== null 
            ? params.value.toString() 
            : '';
        
        div.textContent = value;
        return div;
    }

    /**
     * 创建默认编辑器
     */
    private createDefaultEditor(params: ComponentParams): HTMLElement {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'grid-cell-default-editor';
        input.value = params.value !== undefined && params.value !== null 
            ? params.value.toString() 
            : '';
        
        // 设置样式，确保不会溢出容器
        input.style.width = '100%';
        input.style.maxWidth = '100%';
        input.style.boxSizing = 'border-box';
        input.style.overflow = 'hidden';
        input.style.textOverflow = 'ellipsis';
        
        // 根据数据类型设置适当的输入类型
        if (typeof params.value === 'number') {
            input.type = 'number';
            input.step = '1';  // 可以根据需要调整步长
        } else if (typeof params.value === 'boolean') {
            input.type = 'checkbox';
            input.checked = Boolean(params.value);
        }
        
        // 聚焦
        setTimeout(() => {
            input.focus();
            input.select();
        }, 0);
        
        // 绑定事件
        if (params.onComplete) {
            const onComplete = params.onComplete;
            
            input.addEventListener('keydown', (e: KeyboardEvent) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    onComplete(input.type === 'number' ? parseFloat(input.value) : 
                               input.type === 'checkbox' ? input.checked : 
                               input.value);
                } else if (e.key === 'Escape' && params.onCancel) {
                    e.preventDefault();
                    params.onCancel();
                }
            });
            
            input.addEventListener('blur', () => {
                onComplete(input.type === 'number' ? parseFloat(input.value) : 
                           input.type === 'checkbox' ? input.checked : 
                           input.value);
            });
        }
        
        return input;
    }

    /**
     * 刷新组件
     */
    public refreshComponent(id: string, params: ComponentParams): boolean {
        const component = this.components.get(id);
        if (component && component.refresh) {
            return component.refresh(params);
        }
        return false;
    }

    /**
     * 销毁组件
     */
    public destroyComponent(id: string): void {
        const component = this.components.get(id);
        if (component) {
            if (component.destroy) {
                try {
                    component.destroy();
                } catch (e) {
                    console.error(`组件销毁失败:`, e);
                }
            }
            this.components.delete(id);
        }
        this.componentElements.delete(id);
    }

    /**
     * 销毁所有组件
     */
    public destroyAllComponents(): void {
        this.components.forEach((component, id) => {
            this.destroyComponent(id);
        });
        this.components.clear();
        this.componentElements.clear();
    }
} 