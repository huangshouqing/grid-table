import { ComponentDefinition, IComponentParams } from '@grid-table/core';
import { IFrameworkAdapter, AdapterComponentOptions, PropsHandler } from './types';

/**
 * 框架适配器基类
 * 提供通用的适配器功能，各框架特定适配器继承此类
 */
export abstract class BaseAdapter implements IFrameworkAdapter {
  /**
   * 适配器名称
   */
  abstract readonly name: string;
  
  /**
   * 组件工厂注册表
   * 存储已注册的组件工厂函数
   */
  protected componentFactories: Map<string, {
    component: any;
    options?: AdapterComponentOptions;
  }> = new Map();
  
  /**
   * 默认Props处理函数
   */
  protected defaultPropsHandler: PropsHandler = (params: IComponentParams) => ({
    value: params.value,
    data: params.data,
    rowIndex: params.rowIndex,
    colId: params.colId,
    api: params.api,
    ...params.props
  });
  
  /**
   * 设置默认Props处理函数
   * @param handler Props处理函数
   */
  setDefaultPropsHandler(handler: PropsHandler): void {
    this.defaultPropsHandler = handler;
  }
  
  /**
   * 注册组件工厂函数
   * @param key 组件类型键名
   * @param component 框架特定的组件
   * @param options 组件选项
   */
  registerComponentFactory(key: string, component: any, options?: AdapterComponentOptions): void {
    this.componentFactories.set(key, { component, options });
  }
  
  /**
   * 获取已注册的组件工厂
   * @param key 组件类型键名
   */
  getComponentFactory(key: string): { component: any; options?: AdapterComponentOptions } | undefined {
    return this.componentFactories.get(key);
  }
  
  /**
   * 将框架特定组件转换为grid-table兼容组件
   * 各框架需要重写此方法
   * @param component 框架特定的组件
   * @param options 组件选项
   */
  abstract adaptComponent(component: any, options?: AdapterComponentOptions): ComponentDefinition;
  
  /**
   * 创建组件元素
   * 各框架需要重写此方法
   * @param component 框架特定的组件
   * @param props 组件属性
   */
  protected abstract createComponentElement(component: any, props: Record<string, any>): HTMLElement;
  
  /**
   * 销毁组件
   * 各框架需要重写此方法
   * @param element 组件元素
   * @param componentInstance 组件实例
   */
  protected abstract destroyComponentElement(element: HTMLElement, componentInstance?: any): void;
} 