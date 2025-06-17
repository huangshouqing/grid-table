// 定义组件初始化时接收的参数
export interface IComponentParams {
  value: any; // 单元格的值
  data: any; // 完整行数据
  colDef: any; // 列定义
  api: any; // 表格核心API
  eventBus: any; // 事件总线
  onComplete?: (value: any) => void; // (仅编辑组件) 用于通知表格编辑完成
  onCancel?: () => void; // (仅编辑组件) 用于通知表格取消编辑
  props?: any; // 组件的自定义属性
  node?: any; // 行节点
  rowIndex?: number; // 行索引
  colId?: string; // 列ID
}

// 定义组件必须实现的接口
export interface IComponent {
  // 初始化方法，在组件创建后立即调用，且只调用一次。
  // params: 初始化参数
  init(params: IComponentParams): void;

  // 返回组件的根DOM元素
  getGui(): HTMLElement;

  // (可选) 刷新组件UI。当数据更新时调用。
  // 如果组件能处理刷新，则返回 true；否则表格将销毁并重建组件。
  refresh?(params: IComponentParams): boolean;

  // (可选) 组件销毁前调用的清理方法。用于释放资源，如移除事件监听器。
  destroy?(): void;
}

// 组件定义类型
export interface ComponentDefinition {
  view: any; // 视图组件
  edit?: any; // 编辑组件
} 