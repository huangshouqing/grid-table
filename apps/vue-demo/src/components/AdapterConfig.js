// 使用子路径导入，只导入Vue适配器部分
import { createVueAdapter } from '@grid-table/adapters/vue';
import RatingComponent from './RatingComponent.vue';
import ButtonCellComponent from './ButtonCellComponent.vue';

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
  debugger
  return {
    data: params.data,
    text: params.props?.text || '查看详情',
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

// 导出组件定义
export { vueAdapter, ratingComponentDefinition, buttonComponentDefinition }; 