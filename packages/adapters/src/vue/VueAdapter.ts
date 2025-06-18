import { createApp, Component, App, reactive } from 'vue';
import { ComponentDefinition, IComponentParams } from '@grid-table/core';
import { BaseAdapter } from '../BaseAdapter';
import { AdapterComponentOptions } from '../types';
import { VueComponentWrapper } from './VueComponentWrapper';

/**
 * Vue组件适配器
 * 用于将Vue组件适配为grid-table兼容组件
 */
export class VueAdapter extends BaseAdapter {
  /**
   * 适配器名称
   */
  readonly name = 'vue';
  
  /**
   * 将Vue组件转换为grid-table兼容组件
   * @param component Vue组件
   * @param options 适配选项
   */
  adaptComponent(component: Component, options?: AdapterComponentOptions): ComponentDefinition {
    const componentDef: ComponentDefinition = {};
    
    // 创建视图组件
    componentDef.view = (params: IComponentParams) => {
      // 获取视图props处理函数
      const viewPropsHandler = options?.view?.propsHandler || this.defaultPropsHandler;
      
      // 创建容器元素
      const container = document.createElement('div');
      container.className = 'grid-table-vue-component';
      
      // 处理props
      const props = viewPropsHandler(params);
      
      // 创建Vue应用
      const app = createApp(component, props);
      
      // 挂载到容器
      app.mount(container);
      
      // 存储Vue应用实例以便后续清理
      (container as any).__vueApp = app;
      
      return container;
    };
    
    // 如果提供了编辑选项，创建编辑组件
    if (options?.edit) {
      componentDef.edit = (params: IComponentParams) => {
        // 获取编辑props处理函数
        const editPropsHandler = options.edit?.propsHandler || this.defaultPropsHandler;
        
        // 创建Vue编辑组件包装器
        return new VueComponentWrapper(component, params, editPropsHandler, options.edit?.valueGetter).getGui();
      };
    }
    
    return componentDef;
  }
  
  /**
   * 创建Vue组件元素
   * @param component Vue组件
   * @param props 组件属性
   */
  protected createComponentElement(component: Component, props: Record<string, any>): HTMLElement {
    // 创建容器元素
    const container = document.createElement('div');
    container.className = 'grid-table-vue-component';
    
    // 创建Vue应用
    const app = createApp(component, props);
    
    // 挂载到容器
    app.mount(container);
    
    // 存储Vue应用实例以便后续清理
    (container as any).__vueApp = app;
    
    return container;
  }
  
  /**
   * 销毁Vue组件元素
   * @param element 组件元素
   */
  protected destroyComponentElement(element: HTMLElement): void {
    // 获取Vue应用实例并卸载
    const app = (element as any).__vueApp as App<Element> | undefined;
    if (app) {
      app.unmount();
      delete (element as any).__vueApp;
    }
  }
  
  /**
   * 设置Vue响应式数据同步
   * 将表格数据与Vue响应式系统同步
   * @param gridApi 表格API
   * @param dataRef Vue响应式数据引用
   */
  setupDataSync(gridApi: any, dataRef: any): void {
    // 获取事件总线
    const eventBus = gridApi.getEventBus?.();
    if (!eventBus) return;
    
    // 监听数据变更事件
    eventBus.subscribe('gridDataChanged', (event: any) => {
      if (event.type === 'cellValueChanged') {
        // 找到对应行并强制更新
        if (Array.isArray(dataRef.value)) {
          const rowIndex = dataRef.value.findIndex((row: any) => row.id === event.nodeId);
          if (rowIndex >= 0) {
            // 创建完整行的新引用以触发Vue的响应式更新
            dataRef.value[rowIndex] = { ...dataRef.value[rowIndex] };
          }
        }
      }
    });
  }
} 