/**
 * Grid 类 - 渐进式重构计划
 * 
 * 已完成:
 * [✓] 渲染模块 (GridRenderers) - 提取所有与DOM渲染相关的逻辑到单独的类中
 * [✓] 编辑模块 (GridEditManager) - 提取与单元格编辑相关的所有方法
 * [✓] 数据管理模块 (GridDataManager) - 提取所有数据相关逻辑，包括行节点管理
 * [✓] 拖放模块 (GridDragDropManager) - 提取拖放和拖动填充功能
 * [✓] 过滤排序模块 (GridFilterSortManager) - 提取过滤和排序相关功能
 * [✓] 事件处理模块 (GridEventHandlers)
 *    - 提取所有的事件处理程序(handle*)
 *    - 包括: 点击, 双击, 滚动等
 *    - 将事件逻辑与UI渲染和数据管理分离
 */

import {
  Column,
  GridOptions,
  RowNode,
  GridApi,
  SortModel,
  FilterModel,
  ValueSetParams,
} from "./types/index";
import { ScrollSyncManager } from "./managers/ScrollSyncManager";
import { VirtualDOMManager } from "./managers/VirtualDOMManager";
import { EventManager } from "./managers/EventManager";
import { ComponentManager } from "./managers/ComponentManager";
import { GridState } from "./interface";
import { GridRenderers } from "./renderers/GridRenderers";
import { GridEditManager } from "./managers/GridEditManager";
import { GridDataManager } from "./managers/GridDataManager";
import { GridDragDropManager } from "./managers/GridDragDropManager";
import { GridFilterSortManager } from "./managers/GridFilterSortManager";
import { GridEventHandlers } from "./managers/GridEventHandlers";
import { FormulaManager } from "./managers/FormulaManager";
// 导入 EventBus
import { EventBus } from "./managers/EventBus";
// 添加状态管理

export class Grid implements GridApi {
  private state: GridState;
  private virtualDOM: VirtualDOMManager;
  private eventManager: EventManager;
  private scrollSyncManager: ScrollSyncManager;
  private componentManager: ComponentManager;
  private options: GridOptions;
  private element: HTMLElement;
  private rowNodes: Map<string | number, RowNode> = new Map();
  // 添加渲染器实例
  private renderers: GridRenderers;
  // 添加编辑管理器实例
  private editManager: GridEditManager;
  // 添加数据管理器实例
  private dataManager: GridDataManager;
  // 添加拖拽管理器实例
  private dragDropManager: GridDragDropManager;
  // 添加过滤排序管理器实例
  private filterSortManager: GridFilterSortManager;
  // 添加事件处理器实例
  private eventHandlers: GridEventHandlers;
  // 添加公式管理器
  private formulaManager: FormulaManager;
  // 添加事件总线
  private eventBus: EventBus;

  private leftPinnedColumns: Column[] = [];
  private centerColumns: Column[] = [];
  private rightPinnedColumns: Column[] = [];

  private lastScrollTop: number = 0;
  private lastScrollLeft: number = 0;
  private readonly instanceId: string;

  /**
   * 辅助方法，用于获取GridApi类型的this引用
   * @returns GridApi实例
   */
  private getApi(): GridApi {
    return this as any as GridApi;
  }

  /**
   * 构造函数 - 初始化表格及其所有管理器
   * @param options 表格配置选项
   */
  constructor(options: GridOptions) {
    this.instanceId = `grid-${Math.random().toString(36).substr(2, 9)}`;
    this.options = {
      rowHeight: 40,
      headerHeight: 40,
      ...options,
    };

    this.state = {
      scrollPosition: {
        left: 0,
        top: 0,
        lastLeft: 0,
        lastTop: 0,
      },
      editingCell: null,
      selectedNodes: new Set(),
      sortModel: [],
      filterModel: new Map(),
      columnState: new Map(
        options.columns.map((col, index) => [
          col.field,
          { width: col.width, visible: true, order: index },
        ])
      ),
      dragState: {
        draggedColumn: null,
        draggedElement: null,
        resizeStartX: 0,
        resizeColumn: null,
        resizeElement: null,
      },
      virtualBodyRowIds: new Set<string>(),
    };

    this.element = document.createElement("div");
    this.element.className = "grid-container";

    this.virtualDOM = new VirtualDOMManager(this);
    this.scrollSyncManager = new ScrollSyncManager();
    this.eventManager = new EventManager();
    
    // 初始化事件总线
    this.eventBus = new EventBus();
    
    // 初始化组件管理器，传入事件总线和配置
    this.componentManager = new ComponentManager(this.eventBus, {
      allowMultipleEditors: false // 默认不允许多个编辑组件同时存在
    });

    // 初始化公式管理器
    this.formulaManager = new FormulaManager(this.getApi());

    // 初始化数据管理器
    this.dataManager = new GridDataManager(
      this.state,
      this.options,
      this.rowNodes,
      this.getApi.bind(this)
    );

    // 初始化过滤排序管理器
    this.filterSortManager = new GridFilterSortManager(
      this.element,
      this.state,
      this.options,
      this.getApi.bind(this),
      this.refreshView.bind(this)
    );
    
    // 设置数据管理器与过滤排序管理器的关联
    this.dataManager.setFilterSortManager(this.filterSortManager);

    // 临时的事件处理方法，稍后会被替换
    // 用于解决初始化依赖循环问题
    const tempHandleScroll = (scrollLeft: number, scrollTop: number) => {
      // 暂时什么都不做
    };
    
    // 临时的编辑启动方法
    // 用于解决初始化依赖循环问题
    const tempStartEditing = (cell: HTMLElement, column: Column, row: any, value: any) => {
      // 暂时什么都不做
    };
    
    // 初始化渲染器
    this.renderers = new GridRenderers(
      this.virtualDOM,
      this.scrollSyncManager,
      this.componentManager,
      {
        ...this.options,
        // 添加渲染器需要的回调
        onSortClick: this.filterSortManager.handleSortClick.bind(this.filterSortManager),
        onFilterClick: this.filterSortManager.showFilterMenu.bind(this.filterSortManager),
        // 先使用临时方法
        onStartEditing: tempStartEditing,
        onScroll: tempHandleScroll
      },
      this.state,
      this.instanceId,
      this.rowNodes,
      this.getApi.bind(this),
      null as any, // 临时传入null，因为editManager还未初始化
    );
    
    // 初始化编辑管理器
    this.editManager = new GridEditManager(
      this.virtualDOM,
      this.componentManager,
      this.state,
      this.rowNodes,
      this.getApi.bind(this),
      this.renderers.renderCell.bind(this.renderers),
      this.options,
      this.handleCellValueChange.bind(this)
    );

    // 初始化事件处理器
    this.eventHandlers = new GridEventHandlers(
      this.state,
      this.options,
      this.rowNodes,
      this.getApi.bind(this),
      this.editManager,
      this.refreshView.bind(this)
    );
    
    // 更新渲染器使用事件处理器
    this.renderers = new GridRenderers(
      this.virtualDOM,
      this.scrollSyncManager,
      this.componentManager,
      {
        ...this.options,
        // 添加渲染器需要的回调
        onSortClick: this.filterSortManager.handleSortClick.bind(this.filterSortManager),
        onFilterClick: this.filterSortManager.showFilterMenu.bind(this.filterSortManager),
        onStartEditing: this.eventHandlers.startEditing.bind(this.eventHandlers),
        onScroll: this.eventHandlers.handleScroll.bind(this.eventHandlers)
      },
      this.state,
      this.instanceId,
      this.rowNodes,
      this.getApi.bind(this),
      this.editManager,
    );

    // 初始化拖拽管理器
    this.dragDropManager = new GridDragDropManager(
      this.element,
      this.virtualDOM,
      this.state,
      this.options,
      this.rowNodes,
      this.getApi.bind(this),
      this.dataManager,
      this.refreshView.bind(this),
      // 传递列获取器
      () => this.leftPinnedColumns,
      () => this.centerColumns,
      () => this.rightPinnedColumns
    );

    // 初始化列数据
    this.separateColumns();
    // 更新公式管理器列定义
    this.formulaManager.setColumnDefs(this.options.columns);

    // 初始化行节点
    this.dataManager.initRowNodes();
    // 初始化计算
    this.formulaManager.processAllRows();
    
    this.initializeEventListeners();
    
    // 初始化拖拽相关功能
    this.dragDropManager.initializeDragAndDropListeners();
    
    // 在渲染器选项中添加列宽调整回调
    const renderOptions = {
      ...this.options,
      // 添加渲染器需要的回调
      onSortClick: this.filterSortManager.handleSortClick.bind(this.filterSortManager),
      onFilterClick: this.filterSortManager.showFilterMenu.bind(this.filterSortManager),
      onResizeStart: this.dragDropManager.handleResizeStart.bind(this.dragDropManager),
      onStartEditing: this.eventHandlers.startEditing.bind(this.eventHandlers),
      onScroll: this.eventHandlers.handleScroll.bind(this.eventHandlers)
    };
    
    // 重新初始化渲染器
    this.renderers = new GridRenderers(
      this.virtualDOM,
      this.scrollSyncManager,
      this.componentManager,
      renderOptions,
      this.state,
      this.instanceId,
      this.rowNodes,
      this.getApi.bind(this),
      this.editManager,
    );

    this.refreshView();
  }

  /**
   * 初始化所有事件监听器
   * 将事件与事件处理器关联
   */
  private initializeEventListeners() {
    this.eventManager.on("scroll", this.eventHandlers.handleScroll);
    this.eventManager.on("selectionChange", this.eventHandlers.handleSelectionChange);
    this.eventManager.on("sortChange", this.eventHandlers.handleSortChange);
    this.eventManager.on("filterChange", this.eventHandlers.handleFilterChange);
    this.eventManager.on("editStart", this.eventHandlers.handleEditStart);
    this.eventManager.on("editEnd", this.eventHandlers.handleEditEnd);
  }

  /**
   * 启动单元格编辑 - 保留此方法用于向后兼容
   * @param cell 要编辑的单元格DOM元素
   * @param column 列定义
   * @param row 行数据对象
   * @param value 单元格当前值
   */
  private startEditing(
    cell: HTMLElement,
    column: Column,
    row: any,
    value: any
  ) {
    // 委托给事件处理器(如果可用)，否则直接使用编辑管理器
    if (this.eventHandlers) {
      this.eventHandlers.startEditing(cell, column, row, value);
    } else if (this.editManager) {
      this.editManager.startEditing(cell, column, row, value);
    }
  }

  /**
   * 将表格渲染到指定容器
   * @param container 要渲染表格的DOM容器
   */
  render(container: HTMLElement) {
    // 清空容器
    this.element.innerHTML = "";

    // 使用渲染器创建完整的表格结构
    const gridStructure = this.renderers.renderGridStructure({
      leftPinnedColumns: this.leftPinnedColumns,
      centerColumns: this.centerColumns,
      rightPinnedColumns: this.rightPinnedColumns,
      getFilteredAndSortedData: this.dataManager.getFilteredAndSortedData.bind(this.dataManager),
      onRowClick: this.eventHandlers.handleRowClick.bind(this.eventHandlers),
      onRowDoubleClick: this.eventHandlers.handleRowDoubleClick.bind(this.eventHandlers),
      onCellClick: this.eventHandlers.handleCellClick.bind(this.eventHandlers),
      onCellDoubleClick: (e, col, row, value, rowIndex, cellElement) => this.eventHandlers.handleCellDoubleClick(e, col, row, value, rowIndex, cellElement),
    });

    this.element.appendChild(gridStructure);

    // 清空并添加到容器
    container.innerHTML = "";
    container.appendChild(this.element);
  }

  /**
   * 设置表格行数据
   * @param data 新的行数据数组
   */
  setRowData(data: any[]): void {
    this.options.rowData = data;
    this.dataManager.initRowNodes();
    this.formulaManager.processAllRows();
    this.refreshView();
  }

  /**
   * 获取特定ID的行节点
   * @param id 行ID
   * @returns 找到的行节点或undefined
   */
  getRowNode(id: string | number): RowNode | undefined {
    return this.dataManager.getRowNode(id);
  }

  /**
   * 获取指定索引处显示的行节点
   * @param index 行索引
   * @returns 行节点或undefined
   */
  getDisplayedRowAtIndex(index: number): RowNode | undefined {
    return this.dataManager.getDisplayedRowAtIndex(index);
  }

  /**
   * 获取当前显示的行数量
   * @returns 显示的行数
   */
  getDisplayedRowCount(): number {
    return this.dataManager.getDisplayedRowCount();
  }

  /**
   * 遍历所有行节点
   * @param callback 对每个行节点调用的回调函数
   */
  forEachNode(callback: (node: RowNode, index: number) => void): void {
    let index = 0;
    this.rowNodes.forEach((node) => {
      callback(node, index);
      index++;
    });
  }

  /**
   * 选择所有行
   */
  selectAll(): void {
    this.rowNodes.forEach((node) => {
      node.selected = true;
      this.state.selectedNodes.add(node.id);
    });
    this.refreshView();
  }

  /**
   * 取消选择所有行
   */
  deselectAll(): void {
    this.state.selectedNodes.clear();
    this.rowNodes.forEach((node) => (node.selected = false));
    this.refreshView();
  }

  /**
   * 选择指定ID的行
   * @param id 要选择的行ID
   * @param clearOthers 是否清除其他已选行
   */
  selectRow(id: string | number, clearOthers = true): void {
    if (clearOthers) {
      this.deselectAll();
    }
    const node = this.rowNodes.get(id);
    if (node) {
      node.selected = true;
      this.state.selectedNodes.add(id);
      this.refreshView();
    }
  }

  /**
   * 获取所有已选择的行节点
   * @returns 已选择的行节点数组
   */
  getSelectedNodes(): RowNode[] {
    return Array.from(this.state.selectedNodes).map(
      (id) => this.rowNodes.get(id)!
    );
  }

  /**
   * 获取所有已选择的行数据
   * @returns 已选择的行数据数组
   */
  getSelectedRows(): any[] {
    return this.getSelectedNodes().map((node) => node.data);
  }

  /**
   * 设置表格排序模型
   * @param sortModel 排序模型数组
   */
  setSort(sortModel: SortModel[]): void {
    this.filterSortManager.setSort(sortModel);
  }

  /**
   * 设置列的过滤条件
   * @param columnId 列ID
   * @param filterModel 过滤模型
   */
  setFilter(columnId: string, filterModel: FilterModel): void {
    this.filterSortManager.setFilter(columnId, filterModel);
  }

  /**
   * 设置列定义
   * @param colDefs 新的列定义数组
   */
  setColumnDefs(colDefs: Column[]): void {
    // 使用新的列数组副本，确保引用已更改
    this.options.columns = [...colDefs];
    
    // 重新分离列
    this.separateColumns();
    // 更新公式管理器
    this.formulaManager.setColumnDefs(this.options.columns);
    
    this.refreshView();
  }

  /**
   * 根据列定义中的 'pinned' 属性，将列分离到左固定、右固定和中间滚动区域
   */
  private separateColumns() {
    this.leftPinnedColumns = [];
    this.centerColumns = [];
    this.rightPinnedColumns = [];

    this.options.columns.forEach(col => {
      if (col.pinned === 'left') {
        this.leftPinnedColumns.push(col);
      } else if (col.pinned === 'right') {
        this.rightPinnedColumns.push(col);
      } else {
        this.centerColumns.push(col);
      }
    });
    // 更新公式管理器
    this.formulaManager.setColumnDefs(this.options.columns);
  }

  /**
   * 调整列宽以适应容器宽度
   */
  sizeColumnsToFit(): void {
    if (!this.element) return;

    const totalWidth = this.element.clientWidth;
    const columnCount = this.options.columns.length;
    const width = Math.floor(totalWidth / columnCount);

    this.options.columns.forEach((col) => {
      col.width = width;
    });

    this.refreshView();
  }

  /**
   * 自动调整列宽以适应内容
   * 尚未实现
   */
  autoSizeColumns(): void {
    // 这里可以实现自动调整列宽的逻辑
    // 可以根据内容计算最大宽度
  }

  /**
   * 刷新表格视图
   * 重新渲染整个表格，保持滚动位置
   */
  refreshView(): void {
    if (this.element && this.element.parentElement) {
      // 保存当前滚动位置
      this.saveScrollPosition();

      // 清理所有拖拽样式
      this.dragDropManager.clearDragStyles();

      // 重新渲染整个表格内容
      this.element.innerHTML = "";
      const gridStructure = this.renderers.renderGridStructure({
        leftPinnedColumns: this.leftPinnedColumns,
        centerColumns: this.centerColumns,
        rightPinnedColumns: this.rightPinnedColumns,
        getFilteredAndSortedData: this.dataManager.getFilteredAndSortedData.bind(this.dataManager),
        onRowClick: this.eventHandlers.handleRowClick.bind(this.eventHandlers),
        onRowDoubleClick: this.eventHandlers.handleRowDoubleClick.bind(this.eventHandlers),
        onCellClick: this.eventHandlers.handleCellClick.bind(this.eventHandlers),
        onCellDoubleClick: (e, col, row, value, rowIndex, cellElement) => this.eventHandlers.handleCellDoubleClick(e, col, row, value, rowIndex, cellElement),
      });
      this.element.appendChild(gridStructure);

      // 恢复滚动位置
      this.restoreScrollPosition();
    }
  }

  /**
   * 确保指定索引的行可见
   * @param index 行索引
   * @param position 显示位置("top","middle","bottom")
   */
  ensureIndexVisible(
    index: number,
    position: "top" | "middle" | "bottom" = "middle"
  ): void {
    const rowHeight = this.options.rowHeight || 40;
    // 应该以中间可滚动的body为基准
    const gridBody = this.element.querySelector(".grid-center-container .grid-body") as HTMLElement;
    if (!gridBody) return;

    const bodyHeight = gridBody.clientHeight;
    let scrollTop;

    switch (position) {
      case "top":
        scrollTop = index * rowHeight;
        break;
      case "bottom":
        scrollTop = index * rowHeight - bodyHeight + rowHeight;
        break;
      case "middle":
      default:
        scrollTop = index * rowHeight - bodyHeight / 2 + rowHeight / 2;
    }

    // 直接操作中心滚动区域的 scrollTop
    gridBody.scrollTop = Math.max(0, scrollTop);

    // ScrollSyncManager 会自动同步其他区域
  }

  /**
   * 确保指定节点的行可见
   * @param node 要显示的行节点
   * @param position 显示位置("top","middle","bottom")
   */
  ensureNodeVisible(
    node: RowNode,
    position?: "top" | "middle" | "bottom"
  ): void {
    const data = this.dataManager.getFilteredAndSortedData();
    const index = data.findIndex((row) => row.id === node.id);
    if (index !== -1) {
      this.ensureIndexVisible(index, position);
    }
  }

  /**
   * 批量设置单元格值
   * @param params 批量赋值参数
   */
  setValues(params: ValueSetParams): void {
    this.saveScrollPosition();
    // 确保传递了正确的参数结构
    const node = this.dataManager.getRowNode(params.rowId);
    const column = this.options.columns.find(c => c.field === params.field);
    if (node && column) {
      this.dragDropManager.setValues({
        startNode: node,
        endNode: node,
        column: column,
        value: params.value,
      });
    }
    this.restoreScrollPosition();
  }

  /**
   * 添加新行数据
   * @param data 要添加的行数据
   * @param position 添加位置("top" 或 "bottom")
   */
  addRow(data: any, position: "top" | "bottom" = "bottom"): void {
    const newNode = this.dataManager.addRow(data, position);
    if (newNode && newNode.parent) {
      // New node added, its parent might have aggregation formula.
      // We trigger an update on the parent, pretending one of its fields changed.
      // A dummy field '' is used, as the processUpdate will re-calculate all formulas on the parent
      // that depend on children.
      const updatedNodes = this.formulaManager.processUpdate(newNode.parent, '');
      this.refreshAffectedCells(updatedNodes);
    }
    this.refreshView(); // Still need a general refresh for now to update rows display
  }

  /**
   * 删除指定ID的行
   * @param id 要删除的行ID
   */
  removeRow(id: string | number): void {
    this.dataManager.removeRow(id);
    this.refreshView();
  }

  /**
   * 移动行的位置
   * @param fromIndex 起始索引
   * @param toIndex 目标索引
   */
  moveRow(fromIndex: number, toIndex: number): void {
    this.dragDropManager.moveRow(fromIndex, toIndex);
  }

  /**
   * 获取当前过滤模型
   * @returns 过滤模型对象
   */
  getFilterModel(): { [key: string]: FilterModel } {
    return this.filterSortManager.getFilterModel();
  }

  /**
   * 设置过滤模型
   * @param model 新的过滤模型
   */
  setFilterModel(model: { [key: string]: FilterModel }): void {
    this.filterSortManager.setFilterModel(model);
  }

  /**
   * 清除所有过滤条件
   */
  clearFilters(): void {
    this.filterSortManager.clearFilters();
  }

  /**
   * 保存当前滚动位置
   * 在表格刷新前调用
   */
  private saveScrollPosition() {
    // 专门从中间容器获取滚动位置，因为它同时包含水平和垂直滚动
    const centerBody = this.element.querySelector(".grid-center-container .grid-body") as HTMLElement;
    if (centerBody) {
      this.lastScrollTop = centerBody.scrollTop;
      this.lastScrollLeft = centerBody.scrollLeft;
    }
  }

  /**
   * 恢复之前保存的滚动位置
   * 在表格刷新后调用
   */
  private restoreScrollPosition() {
    requestAnimationFrame(() => {
      const allBodies = this.element.querySelectorAll(".grid-body") as NodeListOf<HTMLElement>;
      const centerBody = this.element.querySelector(".grid-center-container .grid-body") as HTMLElement;
      const centerHeader = this.element.querySelector(".grid-center-container .grid-header") as HTMLElement;

      // 恢复所有body的垂直滚动
      if (this.lastScrollTop > 0) {
        allBodies.forEach(body => {
          body.scrollTop = this.lastScrollTop;
        });
      }

      // 只恢复中间容器的水平滚动
      if (this.lastScrollLeft > 0) {
        if (centerBody) {
          centerBody.scrollLeft = this.lastScrollLeft;
        }
        if (centerHeader) {
          centerHeader.scrollLeft = this.lastScrollLeft;
        }
      }
    });
  }

  /**
   * 批量更新行
   * 通过虚拟DOM实现高效更新
   * @param updatedRows 要更新的行映射
   */
  public batchUpdateRows(updatedRows: Map<string | number, any>) {
    // 这是虚拟DOM实现的占位符
    console.log("通过VirtualDOMManager批量更新行", updatedRows);
    // TODO: 实现虚拟DOM行更新
  }

  /**
   * 销毁表格实例及释放资源
   * 在组件卸载时调用
   */
  destroy() {
    this.scrollSyncManager.destroy();

    // 销毁所有组件
    this.componentManager.destroyAllComponents();

    // 销毁拖拽管理器
    this.dragDropManager.destroy();

    // filterSortManager没有特殊资源需要清理

    if (this.virtualDOM) {
      this.virtualDOM.clear();
    }
    this.eventManager.clear();
    this.eventBus.clear();
  }

  /**
   * 获取组件管理器
   * @returns ComponentManager实例
   */
  getComponentManager(): ComponentManager {
    return this.componentManager;
  }

  /**
   * 获取事件总线
   * @returns 事件总线实例
   */
  getEventBus(): EventBus {
    return this.eventBus;
  }

  /**
   * 刷新单个单元格
   * @param params 包含要刷新的行节点和列定义
   */
  refreshCell(params: { rowNode: RowNode; column: Column; }): void {
    const { rowNode, column } = params;
    const cellId = `${this.instanceId}_cell_${rowNode.id}_${column.field}`;
    const cellElement = this.virtualDOM.getElement(cellId);
    
    if (cellElement) {
      const value = rowNode.data[column.field];
      this.renderers.renderCell(cellElement, column, rowNode.data, value, rowNode.rowIndex);
    }
  }

  /**
   * 当单元格值改变时的处理程序
   * 由 GridEditManager 调用
   */
  private handleCellValueChange(node: RowNode, field: string): void {
    // 步骤 1: 重新计算当前行和所有受级联影响的行
    const updatedNodes = this.formulaManager.processUpdate(node, field);
    
    // 步骤 2: 精确刷新所有受影响的单元格
    this.refreshAffectedCells(updatedNodes);
  }

  private refreshAffectedCells(updatedNodes: Map<RowNode, Set<string>>): void {
    updatedNodes.forEach((fields, node) => {
      fields.forEach(field => {
        const column = this.options.columns.find(c => c.field === field);
        if (column) {
          this.refreshCell({ rowNode: node, column: column });
        }
      });
    });
  }
}
