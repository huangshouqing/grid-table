/**
 * Grid 类 - 渐进式重构计划
 * 
 * 已完成:
 * [✓] 渲染模块 (GridRenderers) - 提取所有与DOM渲染相关的逻辑到单独的类中
 * [✓] 编辑模块 (GridEditManager) - 提取与单元格编辑相关的所有方法
 * [✓] 数据管理模块 (GridDataManager) - 提取所有数据相关逻辑，包括行节点管理
 * [✓] 拖放模块 (GridDragDropManager) - 提取拖放和拖动填充功能
 * [✓] 过滤排序模块 (GridFilterSortManager) - 提取过滤和排序相关功能
 * 
 * 未来拆分计划:
 * 1. 事件处理模块 (GridEventHandlers)
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
  ComponentParams,
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

  private lastScrollTop: number = 0;
  private lastScrollLeft: number = 0;
  private readonly instanceId: string;

  // 辅助方法，用于获取GridApi类型的this引用
  private getApi(): GridApi {
    return this as any as GridApi;
  }

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
    this.componentManager = new ComponentManager();

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
        onStartEditing: this.startEditing.bind(this),
        onScroll: this.handleScroll.bind(this)
      },
      this.state,
      this.instanceId,
      this.rowNodes,
      this.getApi.bind(this)
    );

    // 初始化编辑管理器
    this.editManager = new GridEditManager(
      this.virtualDOM,
      this.componentManager,
      this.state,
      this.rowNodes,
      this.getApi.bind(this),
      this.renderers.renderCell.bind(this.renderers),
      this.options
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
      this.refreshView.bind(this)
    );

    // 初始化行节点
    this.dataManager.initRowNodes();
    
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
      onStartEditing: this.startEditing.bind(this),
      onScroll: this.handleScroll.bind(this)
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
      this.getApi.bind(this)
    );
  }

  private initializeEventListeners() {
    this.eventManager.on("scroll", this.handleScroll);
    this.eventManager.on("selectionChange", this.handleSelectionChange);
    this.eventManager.on("sortChange", this.handleSortChange);
    this.eventManager.on("filterChange", this.handleFilterChange);
    this.eventManager.on("editStart", this.handleEditStart);
    this.eventManager.on("editEnd", this.handleEditEnd);
  }

  private handleScroll = (scrollLeft: number, scrollTop: number) => {
    // 保存当前的滚动位置
    this.state.scrollPosition = {
      top: scrollTop,
      left: scrollLeft,
      lastLeft: this.state.scrollPosition.left,
      lastTop: this.state.scrollPosition.top,
    };

    // 不要在每次滚动时刷新视图，这可能会导致滚动位置重置
    // 仅在需要时（例如视口变化显著）才刷新视图
    const rowHeight = this.options.rowHeight || 40;
    if (
      Math.abs(
        this.state.scrollPosition.top - this.state.scrollPosition.lastTop
      ) >
      rowHeight * 5
    ) {
      this.refreshView();
    }
  };

  private handleSelectionChange = () => {
    this.refreshView();
  };

  private handleSortChange = () => {
    this.refreshView();
  };

  private handleFilterChange = () => {
    this.refreshView();
  };

  private handleEditStart = (params: any) => {
    this.editManager.handleEditStart(params);
    this.refreshView();
  };

  private handleEditEnd = (save: boolean) => {
    this.editManager.handleEditEnd(save);
    this.refreshView();
  };

  // handleSortClick 方法已迁移到 GridFilterSortManager

  // 列宽调整功能已移至 GridDragDropManager 类

  private startEditing(
    cell: HTMLElement,
    column: Column,
    row: any,
    value: any
  ) {
    this.editManager.startEditing(cell, column, row, value);
  }

  private handleRowClick(e: MouseEvent, row: any, rowIndex: number) {
    if (this.options.onRowClicked) {
      const node = this.rowNodes.get(row.id || rowIndex);
      if (node) {
        this.options.onRowClicked({
          node,
          data: row,
          event: e,
        });
      }
    }
  }

  private handleRowDoubleClick(e: MouseEvent, row: any, rowIndex: number) {
    if (this.options.onRowDoubleClicked) {
      const node = this.rowNodes.get(row.id || rowIndex);
      if (node) {
        this.options.onRowDoubleClicked({
          node,
          data: row,
          event: e,
        });
      }
    }
  }

  private handleCellClick(
    e: MouseEvent,
    column: Column,
    row: any,
    value: any,
    rowIndex: number
  ) {
    if (this.options.onCellClicked) {
      const node = this.rowNodes.get(row.id || rowIndex);
      if (node) {
        this.options.onCellClicked({
          node,
          data: row,
          column,
          colId: column.field,
          value,
          event: e,
        });
      }
    }
  }

  private handleCellDoubleClick(
    e: MouseEvent,
    column: Column,
    row: any,
    value: any,
    rowIndex: number
  ) {
    if (this.options.onCellDoubleClicked) {
      const node = this.rowNodes.get(row.id || rowIndex);
      if (node) {
        this.options.onCellDoubleClicked({
          node,
          data: row,
          column,
          colId: column.field,
          value,
          event: e,
        });
      }
    }
  }

  render(container: HTMLElement) {
    // 清空容器
    this.element.innerHTML = "";

    // 使用渲染器渲染表格
    const headerElement = this.renderers.renderHeader();
    const bodyElement = this.renderers.renderBody(this.dataManager.getFilteredAndSortedData.bind(this.dataManager));

    if (headerElement) {
      this.element.appendChild(headerElement);
    }
    if (bodyElement) {
      this.element.appendChild(bodyElement);
    }

    // 清空并添加到容器
    container.innerHTML = "";
    container.appendChild(this.element);
  }

  // GridApi implementation
  setRowData(data: any[]): void {
    this.options.rowData = data;
    this.dataManager.initRowNodes();
    this.refreshView();
  }

  getRowNode(id: string | number): RowNode | undefined {
    return this.dataManager.getRowNode(id);
  }

  getDisplayedRowAtIndex(index: number): RowNode | undefined {
    return this.dataManager.getDisplayedRowAtIndex(index);
  }

  getDisplayedRowCount(): number {
    return this.dataManager.getDisplayedRowCount();
  }

  forEachNode(callback: (node: RowNode, index: number) => void): void {
    let index = 0;
    this.rowNodes.forEach((node) => {
      callback(node, index);
      index++;
    });
  }

  selectAll(): void {
    this.rowNodes.forEach((node) => {
      node.selected = true;
      this.state.selectedNodes.add(node.id);
    });
    this.refreshView();
  }

  deselectAll(): void {
    this.state.selectedNodes.clear();
    this.rowNodes.forEach((node) => (node.selected = false));
    this.refreshView();
  }

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

  getSelectedNodes(): RowNode[] {
    return Array.from(this.state.selectedNodes).map(
      (id) => this.rowNodes.get(id)!
    );
  }

  getSelectedRows(): any[] {
    return this.getSelectedNodes().map((node) => node.data);
  }

  setSort(sortModel: SortModel[]): void {
    this.filterSortManager.setSort(sortModel);
  }

  setFilter(columnId: string, filterModel: FilterModel): void {
    this.filterSortManager.setFilter(columnId, filterModel);
  }

  setColumnDefs(colDefs: Column[]): void {
    // 使用新的列数组副本，确保引用已更改
    this.options.columns = [...colDefs];
    
    // 确保渲染器和过滤排序管理器也更新列定义
    if (this.renderers) {
      this.renderers.updateColumns(this.options.columns);
    }
    
    this.refreshView();
  }

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

  autoSizeColumns(): void {
    // 这里可以实现自动调整列宽的逻辑
    // 可以根据内容计算最大宽度
  }

  refreshView(): void {
    if (this.element && this.element.parentElement) {
      // 保存当前滚动位置
      this.saveScrollPosition();

      // 清理所有拖拽样式
      this.dragDropManager.clearDragStyles();

      // 确保渲染器使用最新的列配置
      this.renderers.updateColumns(this.options.columns);

      // 重新渲染整个表格内容，确保 header 和 body 的一致性
      this.element.innerHTML = "";
      const headerElement = this.renderers.renderHeader();
      const bodyElement = this.renderers.renderBody(this.dataManager.getFilteredAndSortedData.bind(this.dataManager));

      if (headerElement) {
        this.element.appendChild(headerElement);
      }
      if (bodyElement) {
        this.element.appendChild(bodyElement);
      }

      // 恢复滚动位置
      this.restoreScrollPosition();
    }
  }

  ensureIndexVisible(
    index: number,
    position: "top" | "middle" | "bottom" = "middle"
  ): void {
    const rowHeight = this.options.rowHeight || 40;
    const gridBody = this.element.querySelector(".grid-body") as HTMLElement;
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

    this.scrollSyncManager.scrollTo(
      this.state.scrollPosition.left,
      Math.max(0, scrollTop)
    );
  }

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

  // showFilterMenu 和 createDefaultFilterMenu 方法已迁移到 GridFilterSortManager

  // 拖拽填充功能已迁移到 GridDragDropManager 类

  // 实现 GridApi 的批量赋值方法
  setValues(params: ValueSetParams): void {
    this.saveScrollPosition();
    this.dragDropManager.setValues(params);
    this.restoreScrollPosition();
  }

  // 实现新增行操作API
  addRow(data: any, position: "top" | "bottom" = "bottom"): void {
    this.dataManager.addRow(data, position);
    this.refreshView();
  }

  removeRow(id: string | number): void {
    this.dataManager.removeRow(id);
    this.refreshView();
  }

  moveRow(fromIndex: number, toIndex: number): void {
    this.dragDropManager.moveRow(fromIndex, toIndex);
  }

  // 实现缺失的 GridApi 方法
  getFilterModel(): { [key: string]: FilterModel } {
    return this.filterSortManager.getFilterModel();
  }

  setFilterModel(model: { [key: string]: FilterModel }): void {
    this.filterSortManager.setFilterModel(model);
  }

  clearFilters(): void {
    this.filterSortManager.clearFilters();
  }

  private saveScrollPosition() {
    // 保存body的滚动位置
    const gridBody = this.element.querySelector(".grid-body") as HTMLElement;
    if (gridBody) {
      this.lastScrollTop = gridBody.scrollTop;
      this.lastScrollLeft = gridBody.scrollLeft;
    }
  }

  private restoreScrollPosition() {
    // 使用更可靠的方法恢复滚动位置
    requestAnimationFrame(() => {
      const gridBody = this.element.querySelector(".grid-body") as HTMLElement;

      if (gridBody) {
        // 先设置水平滚动位置，避免垂直滚动时重置水平位置
        if (this.lastScrollLeft > 0) {
          gridBody.scrollLeft = this.lastScrollLeft;
        }

        // 再设置垂直滚动位置
        if (this.lastScrollTop > 0) {
          gridBody.scrollTop = this.lastScrollTop;
        }

        // 同步header的水平滚动位置
        const headerElement = this.element.querySelector(".grid-header");
        if (headerElement && this.lastScrollLeft > 0) {
          headerElement.scrollLeft = this.lastScrollLeft;
        }
      }
    });
  }

  public batchUpdateRows(updatedRows: Map<string | number, any>) {
    // This is a placeholder for the virtual DOM implementation.
    console.log("Batch updating rows via VirtualDOMManager", updatedRows);
    // TODO: Implement virtual DOM row updates
  }

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
  }

  /**
   * 获取组件管理器
   * @returns ComponentManager实例
   */
  getComponentManager(): ComponentManager {
    return this.componentManager;
  }
}
