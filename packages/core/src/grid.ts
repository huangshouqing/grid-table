/**
 * Grid 类 - 渐进式重构计划
 * 
 * 已完成:
 * [✓] 渲染模块 (GridRenderers) - 提取所有与DOM渲染相关的逻辑到单独的类中
 * [✓] 编辑模块 (GridEditManager) - 提取与单元格编辑相关的所有方法
 * [✓] 数据管理模块 (GridDataManager) - 提取所有数据相关逻辑，包括行节点管理
 * [✓] 拖放模块 (GridDragDropManager) - 提取拖放和拖动填充功能
 * 
 * 未来拆分计划:
 * 1. 事件处理模块 (GridEventHandlers)
 *    - 提取所有的事件处理程序(handle*)
 *    - 包括: 点击, 双击, 滚动等
 *    - 将使事件逻辑与UI渲染和数据管理分离
 * 
 * 2. 过滤排序模块 (GridFilterSortManager)
 *    - 提取过滤和排序相关功能
 *    - 包括: showFilterMenu, createDefaultFilterMenu, sortModel等
 *    - 将过滤和排序算法解耦，便于扩展和维护
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

    // 初始化渲染器
    this.renderers = new GridRenderers(
      this.virtualDOM,
      this.scrollSyncManager,
      this.componentManager,
      {
        ...this.options,
        // 添加渲染器需要的回调
        onSortClick: this.handleSortClick.bind(this),
        onFilterClick: this.showFilterMenu.bind(this),
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
      onSortClick: this.handleSortClick.bind(this),
      onFilterClick: this.showFilterMenu.bind(this),
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

  private handleSortClick(e: MouseEvent, column: Column) {
    if (!column.sortable) return;

    const headerCell = (e.target as HTMLElement).closest(".grid-header-cell");
    if (!headerCell) return;

    const existingSort = this.state.sortModel.find(
      (s) => s.colId === column.field
    );

    // 更新排序状态
    if (!existingSort) {
      this.state.sortModel = [{ colId: column.field, sort: "asc" }];
      headerCell.setAttribute("data-sort", "asc");
    } else if (existingSort.sort === "asc") {
      this.state.sortModel = [{ colId: column.field, sort: "desc" }];
      headerCell.setAttribute("data-sort", "desc");
    } else {
      this.state.sortModel = [];
      headerCell.removeAttribute("data-sort");
    }

    // 清除其他列的排序状态
    const otherHeaders = this.element.querySelectorAll(
      `.grid-header-cell:not([data-field="${column.field}"])`
    );
    otherHeaders.forEach((header) => header.removeAttribute("data-sort"));

    // 触发排序变更事件
    if (this.options.onSortChanged) {
      this.options.onSortChanged({
        sortModel: this.state.sortModel,
        api: this.getApi(),
      });
    }

    this.refreshView();
  }

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
    this.state.sortModel = sortModel;
    this.refreshView();
  }

  setFilter(columnId: string, filterModel: FilterModel): void {
    this.state.filterModel.set(columnId, filterModel);
    this.refreshView();
  }

  setColumnDefs(colDefs: Column[]): void {
    this.options.columns = colDefs;
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

  private showFilterMenu(e: MouseEvent, column: Column) {
    const button = e.currentTarget as HTMLElement;
    const buttonRect = button.getBoundingClientRect();
    const headerRect = this.element.getBoundingClientRect();

    // 创建筛选菜单
    const menu = document.createElement("div");
    menu.className = "grid-filter-menu";

    // 如果有自定义筛选组件
    if (column.filterParams?.filterComponent) {
      const filterModel = this.state.filterModel.get(column.field) || {
        type: "equals",
        filterType: "text",
      };

      const component = column.filterParams.filterComponent({
        column,
        api: this.getApi(),
        value: filterModel.filter,
        filterModel,
        onFilterChanged: (model) => {
          if (model.filter) {
            this.state.filterModel.set(column.field, model);
          } else {
            this.state.filterModel.delete(column.field);
          }
          this.refreshView();
          menu.remove();
        },
        getUniqueValues: () => {
          const values = new Set<any>();
          if (Array.isArray(this.options.rowData)) {
            this.options.rowData.forEach((row) => {
              const value = row[column.field];
              if (value !== undefined && value !== null) {
                values.add(value);
              }
            });
          }
          return Array.from(values);
        },
      });

      menu.appendChild(component);
    } else {
      // 默认筛选菜单
      this.createDefaultFilterMenu(menu, column);
    }

    // 定位菜单 - 相对于按钮定位
    menu.style.position = "absolute";
    menu.style.top = `${buttonRect.bottom - headerRect.top}px`;
    // 水平居中对齐按钮
    menu.style.left = `${
      buttonRect.left - headerRect.left - (200 - buttonRect.width) / 2
    }px`;

    // 添加点击外部关闭
    const closeMenu = (e: MouseEvent) => {
      if (!menu.contains(e.target as Node)) {
        menu.remove();
        document.removeEventListener("click", closeMenu);
      }
    };

    // 延迟添加事件监听，避免立即触发
    setTimeout(() => {
      document.addEventListener("click", closeMenu);
    });

    this.element.appendChild(menu);
  }

  private createDefaultFilterMenu(menu: HTMLElement, column: Column) {
    const filterModel = this.state.filterModel.get(column.field) || {
      type: "equals",
      filterType: "text",
    };

    // 筛选类型选择
    const typeSelect = document.createElement("select");
    typeSelect.className = "grid-filter-type-select";

    const types = [
      { value: "equals", label: "等于" },
      { value: "notEqual", label: "不等于" },
      { value: "contains", label: "包含" },
      { value: "notContains", label: "不包含" },
      { value: "startsWith", label: "开头是" },
      { value: "endsWith", label: "结尾是" },
    ];

    types.forEach((type) => {
      const option = document.createElement("option");
      option.value = type.value;
      option.textContent = type.label;
      if (type.value === filterModel.type) {
        option.selected = true;
      }
      typeSelect.appendChild(option);
    });

    // 筛选值输入
    const input = document.createElement("input");
    input.className = "grid-filter-input";
    input.type = "text";
    input.value = (filterModel.filter as string) || "";

    // 按钮容器
    const buttonContainer = document.createElement("div");
    buttonContainer.className = "grid-filter-buttons";

    // 确定按钮
    const applyButton = document.createElement("button");
    applyButton.textContent = "确定";
    applyButton.addEventListener("click", () => {
      const value = input.value.trim();
      if (value) {
        this.state.filterModel.set(column.field, {
          type: typeSelect.value as FilterModel["type"],
          filter: value,
          filterType: "text",
        });
      } else {
        this.state.filterModel.delete(column.field);
      }
      this.refreshView();
      menu.remove();
    });

    // 清除按钮
    const clearButton = document.createElement("button");
    clearButton.textContent = "清除";
    clearButton.addEventListener("click", () => {
      this.state.filterModel.delete(column.field);
      this.refreshView();
      menu.remove();
    });

    buttonContainer.appendChild(clearButton);
    buttonContainer.appendChild(applyButton);

    menu.appendChild(typeSelect);
    menu.appendChild(input);
    menu.appendChild(buttonContainer);
  }

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
    const model: { [key: string]: FilterModel } = {};
    this.state.filterModel.forEach((value, key) => {
      model[key] = value;
    });
    return model;
  }

  setFilterModel(model: { [key: string]: FilterModel }): void {
    this.state.filterModel.clear();
    Object.entries(model).forEach(([key, value]) => {
      this.state.filterModel.set(key, value);
    });
    this.refreshView();
  }

  clearFilters(): void {
    this.state.filterModel.clear();
    this.refreshView();
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
