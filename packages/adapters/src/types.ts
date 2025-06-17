import { IComponent, IComponentParams, ComponentDefinition } from '@grid-table/core';

/**
 * 组件适配器接口
 * 定义了不同框架适配器必须实现的方法
 */
export interface IFrameworkAdapter {
  /**
   * 适配器名称
   */
  readonly name: string;
  
  /**
   * 将框架特定组件转换为grid-table兼容组件
   * @param component 框架特定的组件
   * @param options 组件选项
   */
  adaptComponent(component: any, options?: AdapterComponentOptions): ComponentDefinition;
  
  /**
   * 注册组件工厂函数
   * @param key 组件类型键名 
   * @param component 框架特定的组件
   * @param options 组件选项
   */
  registerComponentFactory(key: string, component: any, options?: AdapterComponentOptions): void;
  
  /**
   * 设置默认Props处理函数
   * @param handler Props处理函数
   */
  setDefaultPropsHandler(handler: PropsHandler): void;
}

/**
 * 组件适配选项
 */
export interface AdapterComponentOptions {
  /**
   * 视图模式配置
   */
  view?: {
    /**
     * Props转换处理器
     */
    propsHandler?: PropsHandler;
  };
  
  /**
   * 编辑模式配置
   */
  edit?: {
    /**
     * Props转换处理器
     */
    propsHandler?: PropsHandler;
    
    /**
     * 获取值的函数
     */
    valueGetter?: (component: any) => any;
  };
}

/**
 * Props处理函数类型
 * 用于转换grid-table组件参数为框架特定的props
 */
export type PropsHandler = (params: IComponentParams) => Record<string, any>;

/**
 * 框架组件包装器接口
 * 用于将框架组件包装为grid-table兼容的组件
 */
export interface IComponentWrapper extends IComponent {
  /**
   * 获取原始框架组件实例
   */
  getWrappedComponent(): any;
} 