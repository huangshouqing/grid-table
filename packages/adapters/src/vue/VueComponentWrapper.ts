import { createApp, Component, App } from 'vue';
import { IComponentParams } from '@grid-table/core';
import { PropsHandler, IComponentWrapper } from '../types';

/**
 * Vue组件包装器
 * 将Vue组件包装为grid-table兼容的组件
 */
export class VueComponentWrapper implements IComponentWrapper {
  private params: IComponentParams;
  private component: Component;
  private container: HTMLElement;
  private propsHandler: PropsHandler;
  private valueGetter?: (component: any) => any;
  private app: App<Element> | null = null;
  private componentInstance: any = null;

  /**
   * 构造函数
   * @param component Vue组件
   * @param params 组件参数
   * @param propsHandler props处理函数
   * @param valueGetter 获取值的函数
   */
  constructor(
    component: Component,
    params: IComponentParams,
    propsHandler: PropsHandler,
    valueGetter?: (component: any) => any
  ) {
    this.component = component;
    this.params = params;
    this.propsHandler = propsHandler;
    this.valueGetter = valueGetter;
    
    // 创建容器元素
    this.container = document.createElement('div');
    this.container.className = 'grid-table-vue-component-wrapper';
    
    // 初始化组件
    this.init(params);
  }
  
  /**
   * 初始化组件
   * @param params 组件参数
   */
  init(params: IComponentParams): void {
    this.params = params;
    this.renderComponent();
  }
  
  /**
   * 获取组件的DOM元素
   */
  getGui(): HTMLElement {
    return this.container;
  }
  
  /**
   * 获取包装的Vue组件实例
   */
  getWrappedComponent(): any {
    return this.componentInstance;
  }
  
  /**
   * 刷新组件
   * @param params 新的组件参数
   */
  refresh(params: IComponentParams): boolean {
    this.params = params;
    this.renderComponent();
    return true;
  }
  
  /**
   * 销毁组件
   */
  destroy(): void {
    if (this.app) {
      this.app.unmount();
      this.app = null;
    }
    this.componentInstance = null;
  }
  
  /**
   * 渲染Vue组件
   */
  private renderComponent(): void {
    // 如果之前有应用实例，先卸载
    if (this.app) {
      this.app.unmount();
    }
    
    // 处理props
    const props = {
      ...this.propsHandler(this.params),
      onComplete: (value: any) => {
        if (this.params.onComplete) {
          // 如果提供了valueGetter，使用它获取值
          const finalValue = this.valueGetter && this.componentInstance 
            ? this.valueGetter(this.componentInstance) 
            : value;
          
          this.params.onComplete(finalValue);
        }
      },
      onCancel: () => {
        if (this.params.onCancel) {
          this.params.onCancel();
        }
      }
    };
    
    // 创建Vue应用
    this.app = createApp(this.component, props);
    
    // 添加ref获取组件实例的钩子
    this.app.config.globalProperties.$getComponentInstance = (instance: any) => {
      this.componentInstance = instance;
    };
    
    // 挂载到容器
    this.app.mount(this.container);
  }
} 