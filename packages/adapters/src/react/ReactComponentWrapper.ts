import { createRoot } from 'react-dom/client';
import { createElement, ComponentType } from 'react';
import { IComponent, IComponentParams } from '@grid-table/core';
import { PropsHandler, IComponentWrapper } from '../types';

/**
 * React组件包装器
 * 将React组件包装为grid-table兼容的组件
 */
export class ReactComponentWrapper implements IComponentWrapper {
  private params: IComponentParams;
  private component: ComponentType<any>;
  private container: HTMLElement;
  private propsHandler: PropsHandler;
  private valueGetter?: (component: any) => any;
  private componentInstance: any = null;
  private root: any;

  /**
   * 构造函数
   * @param component React组件
   * @param params 组件参数
   * @param propsHandler props处理函数
   * @param valueGetter 获取值的函数
   */
  constructor(
    component: ComponentType<any>,
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
    this.container.className = 'grid-table-react-component-wrapper';
    
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
   * 获取包装的React组件实例
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
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
    this.componentInstance = null;
  }
  
  /**
   * 渲染React组件
   */
  private renderComponent(): void {
    // 处理props
    const props = {
      ...this.propsHandler(this.params),
      ref: (instance: any) => {
        this.componentInstance = instance;
      },
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
    
    // 创建React元素
    const reactElement = createElement(this.component, props);
    
    // 如果已有root，直接更新
    if (this.root) {
      this.root.render(reactElement);
    } else {
      // 否则创建新的root
      this.root = createRoot(this.container);
      this.root.render(reactElement);
    }
  }
} 