import { createRoot, Root } from 'react-dom/client';
import { createElement, ComponentType } from 'react';
import { ComponentDefinition, IComponentParams } from '@grid-table/core';
import { BaseAdapter } from '../BaseAdapter';
import { AdapterComponentOptions, PropsHandler } from '../types';
import { ReactComponentWrapper } from './ReactComponentWrapper';

/**
 * React组件适配器
 * 用于将React组件适配为grid-table兼容组件
 */
export class ReactAdapter extends BaseAdapter {
  /**
   * 适配器名称
   */
  readonly name = 'react';
  
  /**
   * 将React组件转换为grid-table兼容组件
   * @param component React组件
   * @param options 适配选项
   */
  adaptComponent(component: ComponentType<any>, options?: AdapterComponentOptions): ComponentDefinition {
    const componentDef: ComponentDefinition = {};
    
    // 创建视图组件
    componentDef.view = (params: IComponentParams) => {
      // 获取视图props处理函数
      const viewPropsHandler = options?.view?.propsHandler || this.defaultPropsHandler;
      
      // 创建容器元素
      const container = document.createElement('div');
      container.className = 'grid-table-react-component';
      
      // 创建React组件
      const props = viewPropsHandler(params);
      const reactElement = createElement(component, props);
      
      // 渲染到容器中
      const root = createRoot(container);
      root.render(reactElement);
      
      // 存储React根节点引用以便后续清理
      (container as any).__reactRoot = root;
      
      return container;
    };
    
    // 如果提供了编辑选项，创建编辑组件
    if (options?.edit) {
      componentDef.edit = (params: IComponentParams) => {
        // 获取编辑props处理函数
        const editPropsHandler = options.edit?.propsHandler || this.defaultPropsHandler;
        
        // 创建React编辑组件包装器
        return new ReactComponentWrapper(component, params, editPropsHandler, options.edit?.valueGetter).getGui();
      };
    }
    
    return componentDef;
  }
  
  /**
   * 创建React组件元素
   * @param component React组件
   * @param props 组件属性
   */
  protected createComponentElement(component: ComponentType<any>, props: Record<string, any>): HTMLElement {
    // 创建容器元素
    const container = document.createElement('div');
    container.className = 'grid-table-react-component';
    
    // 创建React组件
    const reactElement = createElement(component, props);
    
    // 渲染到容器中
    const root = createRoot(container);
    root.render(reactElement);
    
    // 存储React根节点引用以便后续清理
    (container as any).__reactRoot = root;
    
    return container;
  }
  
  /**
   * 销毁React组件元素
   * @param element 组件元素
   */
  protected destroyComponentElement(element: HTMLElement): void {
    // 获取React根节点并卸载组件
    const root = (element as any).__reactRoot as Root | undefined;
    if (root) {
      root.unmount();
      delete (element as any).__reactRoot;
    }
  }
} 