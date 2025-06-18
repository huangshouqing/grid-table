// 使用子路径导入，只导入Vue适配器部分
import { createVueAdapter } from '@grid-table/adapters/vue';
import RatingComponent from './RatingComponent.vue';
import ButtonCellComponent from './ButtonCellComponent.vue';
import DeleteButtonComponent from './DeleteButtonComponent.vue';

// 创建Vue适配器实例
const vueAdapter = createVueAdapter();

// 定义Rating组件的props处理函数
const ratingPropsHandler = (params) => {
  return {
    value: params.value || 0,
    readOnly: params.mode !== 'edit'
  };
};

// 定义值获取函数
const ratingValueGetter = (component) => {
  return component.rating;
};

// 定义Button组件的props处理函数
const buttonPropsHandler = (params) => {
  // 确保将所有必要的参数传递给组件
  return {
    data: params.data || {},
    text: params.props?.text || '查看详情',
    api: params.api, // 确保传递完整的API对象
    rowIndex: params.rowIndex,
    colId: params.colId,
    column: params.column,
    node: params.node
  };
};

// 定义删除按钮组件的props处理函数
const deleteButtonPropsHandler = (params) => {
  return {
    data: params.data || {},
    api: params.api,
    rowIndex: params.rowIndex
  };
};

// 适配Rating组件
const ratingComponentDefinition = vueAdapter.adaptComponent(RatingComponent, {
  view: {
    propsHandler: ratingPropsHandler
  },
  edit: {
    propsHandler: ratingPropsHandler,
    valueGetter: ratingValueGetter
  }
});

// 适配Button组件
const buttonComponentDefinition = vueAdapter.adaptComponent(ButtonCellComponent, {
  view: {
    propsHandler: buttonPropsHandler
  }
});

// 适配删除按钮组件
const deleteButtonComponentDefinition = vueAdapter.adaptComponent(DeleteButtonComponent, {
  view: {
    propsHandler: deleteButtonPropsHandler
  }
});

// 导出组件定义
export { 
  vueAdapter, 
  ratingComponentDefinition, 
  buttonComponentDefinition, 
  deleteButtonComponentDefinition 
}; 