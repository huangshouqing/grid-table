/**
 * Grid 类 - 渐进式重构计划
 * 
 * 已完成:
 * [✓] 渲染模块 (GridRenderers) - 提取所有与DOM渲染相关的逻辑到单独的类中
 * [✓] 编辑模块 (GridEditManager) - 提取与单元格编辑相关的所有方法
 * [✓] 数据管理模块 (GridDataManager) - 提取所有数据相关逻辑，包括行节点管理
 * 
 * 未来拆分计划:
 * 1. 事件处理模块 (GridEventHandlers)
 *    - 提取所有的事件处理程序(handle*)
 *    - 包括: 点击, 双击, 滚动, 拖拽事件等
 *    - 将使事件逻辑与UI渲染和数据管理分离
 * 
 * 2. 拖放模块 (GridDragDropManager)
 *    - 提取拖放和拖动填充功能
 *    - 包括: 行拖拽, 单元格拖放, 列拖动等
 *    - 分离复杂的拖放交互逻辑
 * 
 * 3. 过滤排序模块 (GridFilterSortManager)
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

  private lastScrollTop: number = 0;
  private lastScrollLeft: number = 0;
  private readonly instanceId: string;
  private _dragOverAnimFrame: number | null = null; // 添加帧动画ID跟踪

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
        onResizeStart: this.handleResizeStart.bind(this),
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

    // 初始化行节点
    this.dataManager.initRowNodes();
    
    this.initializeEventListeners();
    this.initializeDragToFill();
    this.initializeDragAndDropListeners();
  }

  private initializeEventListeners() {
    this.eventManager.on("scroll", this.handleScroll);
    this.eventManager.on("selectionChange", this.handleSelectionChange);
    this.eventManager.on("sortChange", this.handleSortChange);
    this.eventManager.on("filterChange", this.handleFilterChange);
    this.eventManager.on("editStart", this.handleEditStart);
    this.eventManager.on("editEnd", this.handleEditEnd);

    // 初始化行拖拽事件
    if (this.options.enableRowDrag) {
      this.initializeRowDragEvents();
    }
  }

  private initializeRowDragEvents() {
    // 添加拖拽相关事件监听
    this.element.addEventListener("dragover", this.handleRowDragOver);
    this.element.addEventListener("drop", this.handleRowDrop);
    this.element.addEventListener("dragend", this.handleRowDragEnd);
  }

  private handleRowDragOver = (e: DragEvent) => {
    e.preventDefault();
    if (!e.dataTransfer) return;

    e.dataTransfer.dropEffect = "move";

    // 获取目标行
    const targetRow = (e.target as HTMLElement).closest(
      ".grid-row"
    ) as HTMLElement;
    if (!targetRow) return;

    // 使用requestAnimationFrame防止过度绘制
    if (this._dragOverAnimFrame) {
      cancelAnimationFrame(this._dragOverAnimFrame);
    }

    this._dragOverAnimFrame = requestAnimationFrame(() => {
      // 移除所有拖拽指示器
      const allRows = this.element.querySelectorAll(".grid-row");
      allRows.forEach((row) => {
        row.classList.remove("grid-row-drag-above", "grid-row-drag-below");
      });

      // 确定拖拽位置（上方或下方）
      const rect = targetRow.getBoundingClientRect();
      const middleY = rect.top + rect.height / 2;
      const isAbove = e.clientY < middleY;

      // 添加拖拽指示器
      if (isAbove) {
        targetRow.classList.add("grid-row-drag-above");
      } else {
        targetRow.classList.add("grid-row-drag-below");
      }
    });
  };

  private handleRowDrop = (e: DragEvent) => {
    e.preventDefault();
    if (!e.dataTransfer) return;

    try {
      // 获取拖拽数据
      const dragData = JSON.parse(e.dataTransfer.getData("application/json"));
      const { rowId, rowIndex: fromIndex } = dragData;

      // 获取目标行
      const targetRow = (e.target as HTMLElement).closest(
        ".grid-row"
      ) as HTMLElement;
      if (!targetRow) return;

      const targetRowId = targetRow.getAttribute("data-row-id");
      if (!targetRowId) return;

      const targetNode = this.rowNodes.get(targetRowId);
      if (!targetNode) return;

      const toIndex = targetNode.rowIndex;

      // 如果是同一行，不执行操作
      if (fromIndex === toIndex) return;

      // 确定拖拽位置（上方或下方）
      const rect = targetRow.getBoundingClientRect();
      const middleY = rect.top + rect.height / 2;
      const isAbove = e.clientY < middleY;

      // 计算实际的目标索引
      const actualToIndex = isAbove ? toIndex : toIndex + 1;

      // 移动行
      const movedNode = this.dataManager.moveRow(fromIndex, actualToIndex);

      // 移除所有拖拽指示器
      this.clearDragStyles();

      // 触发行拖拽结束事件
      if (this.options.onRowDragEnd && movedNode) {
        this.options.onRowDragEnd({
          node: movedNode,
          data: movedNode.data,
          fromIndex,
          toIndex: actualToIndex,
          event: e,
        });
      }

      this.refreshView();
    } catch (error) {
      console.error("Error handling row drop:", error);
    }
  };

  private handleRowDragEnd = () => {
    // 移除所有拖拽指示器
    this.clearDragStyles();
  };

  // 清理所有拖拽相关样式
  private clearDragStyles(): void {
    // 确保在下一帧执行，让DOM有时间更新
    requestAnimationFrame(() => {
      const allRows = this.element.querySelectorAll(".grid-row");
      allRows.forEach((row) => {
        row.classList.remove(
          "grid-row-drag-above",
          "grid-row-drag-below",
          "grid-row-dragging"
        );
      });
    });
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

  private initializeDragAndDropListeners() {
    this.element.addEventListener("dragstart", this.handleDragStart.bind(this));
    this.element.addEventListener("dragover", this.handleDragOver.bind(this));
    this.element.addEventListener("drop", this.handleDrop.bind(this));
    this.element.addEventListener("dragend", this.handleDragEnd.bind(this));
  }

  private handleDragStart(e: DragEvent) {
    const element = (e.target as HTMLElement).closest(".grid-header-cell");
    if (!element || !e.dataTransfer || !(e.target as HTMLElement).draggable) {
      return;
    }

    const field = (element as HTMLElement).dataset.field;
    if (!field) return;

    const column = this.options.columns.find((c) => c.field === field);
    if (!column) return;

    this.state.dragState.draggedColumn = column;
    this.state.dragState.draggedElement = element as HTMLElement;

    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", column.field);

    element.classList.add("dragging");
  }

  private handleDragOver(e: DragEvent) {
    const element = (e.target as HTMLElement).closest(".grid-header-cell");
    if (!element) return;

    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "move";
    }
  }

  private handleDrop(e: DragEvent) {
    e.preventDefault();
    const targetElement = (e.target as HTMLElement).closest(
      ".grid-header-cell"
    );
    if (!targetElement) return;

    const field = (targetElement as HTMLElement).dataset.field;
    if (!field) return;

    const targetColumn = this.options.columns.find((c) => c.field === field);
    const { draggedColumn } = this.state.dragState;

    if (!draggedColumn || !targetColumn || draggedColumn === targetColumn)
      return;

    const sourceIndex = this.options.columns.indexOf(draggedColumn);
    const targetIndex = this.options.columns.indexOf(targetColumn);

    if (sourceIndex === -1 || targetIndex === -1) return;

    const columns = [...this.options.columns];
    columns.splice(sourceIndex, 1);
    columns.splice(targetIndex, 0, draggedColumn);

    this.options.columns = columns;

    // 清理拖拽样式
    this.clearDragStyles();

    this.refreshView();
  }

  private handleDragEnd() {
    const { draggedElement } = this.state.dragState;
    if (draggedElement) {
      draggedElement.classList.remove("dragging");
    }
    this.state.dragState.draggedColumn = null;
    this.state.dragState.draggedElement = null;
    
    // 清理所有拖拽相关样式
    this.clearDragStyles();
  }

  private handleResizeStart(
    e: MouseEvent,
    column: Column,
    element: HTMLElement
  ) {
    e.preventDefault();
    this.state.dragState.resizeStartX = e.clientX;
    this.state.dragState.resizeColumn = column;
    this.state.dragState.resizeElement = element;
    document.body.style.cursor = "col-resize";

    // 添加全局鼠标事件监听
    document.addEventListener("mousemove", this.handleResizeMove);
    document.addEventListener("mouseup", this.handleResizeEnd);
  }

  private handleResizeMove = (e: MouseEvent) => {
    if (
      !this.state.dragState.resizeColumn ||
      !this.state.dragState.resizeElement
    )
      return;

    const diff = e.clientX - this.state.dragState.resizeStartX;
    const newWidth = Math.max(
      50,
      this.state.dragState.resizeColumn.width + diff
    );

    this.state.dragState.resizeColumn.width = newWidth;
    this.state.dragState.resizeElement.style.width = `${newWidth}px`;

    // 更新对应的数据单元格宽度
    const columnIndex = this.options.columns.indexOf(
      this.state.dragState.resizeColumn
    );
    const cells = this.element.querySelectorAll(
      `.grid-row .grid-cell:nth-child(${columnIndex + 1})`
    );
    cells.forEach(
      (cell) => ((cell as HTMLElement).style.width = `${newWidth}px`)
    );

    this.state.dragState.resizeStartX = e.clientX;
  };

  private handleResizeEnd = () => {
    this.state.dragState.resizeColumn = null;
    this.state.dragState.resizeElement = null;
    document.body.style.cursor = "";

    // 移除全局鼠标事件监听
    document.removeEventListener("mousemove", this.handleResizeMove);
    document.removeEventListener("mouseup", this.handleResizeEnd);
  };

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
      this.clearDragStyles();

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

  private initializeDragToFill() {
    let isDragging = false;
    let startCell: HTMLElement | null = null;
    let startNode: RowNode | null = null;
    let startColumn: Column | null = null;
    let startValue: any = null;

    // 添加拖拽事件监听
    this.element.addEventListener("mousedown", (e: MouseEvent) => {
      const handle = (e.target as HTMLElement).closest(
        ".grid-cell-drag-handle"
      );
      if (!handle) return;

      const cell = handle.closest(".grid-cell") as HTMLElement;
      const row = cell.closest(".grid-row") as HTMLElement;
      if (!cell || !row) return;

      e.preventDefault(); // 阻止默认行为
      e.stopPropagation();
      isDragging = true;
      startCell = cell;

      // 添加禁止选择文本的样式
      document.body.style.userSelect = "none";
      (document.body.style as any).webkitUserSelect = "none";

      const rowId = row.getAttribute("data-row-id");
      const field = cell.getAttribute("data-field");

      if (rowId && field) {
        const node = this.rowNodes.get(rowId);
        const column = this.options.columns.find((col) => col.field === field);

        if (node && column) {
          startNode = node;
          startColumn = column;
          startValue = node.data[field];
        }
      }

      document.body.style.cursor = "crosshair";
      document.addEventListener("mousemove", handleDrag);
      document.addEventListener("mouseup", handleDragEnd);
    });

    const handleDrag = (e: MouseEvent) => {
      if (!isDragging || !startCell) return;

      e.preventDefault(); // 阻止默认行为
      const currentCell = (e.target as HTMLElement).closest(
        ".grid-cell"
      ) as HTMLElement;
      if (currentCell) {
        this.highlightDragRange(startCell, currentCell);
      }
    };

    const handleDragEnd = (e: MouseEvent) => {
      if (!isDragging || !startCell || !startNode || !startColumn) return;

      e.preventDefault(); // 阻止默认行为

      // 恢复文本选择
      document.body.style.userSelect = "";
      (document.body.style as any).webkitUserSelect = "";

      const endCell = (e.target as HTMLElement).closest(
        ".grid-cell"
      ) as HTMLElement;
      if (endCell) {
        const endRow = endCell.closest(".grid-row") as HTMLElement;
        if (endRow) {
          const endRowId = endRow.getAttribute("data-row-id");
          const endColField = endCell.getAttribute("data-field");

          if (endRowId && endColField) {
            const endNode = this.rowNodes.get(endRowId);
            const endColumn = this.options.columns.find(
              (col) => col.field === endColField
            );

            if (endNode && endColumn) {
              this.setValues({
                startNode,
                startColumn,
                endNode,
                endColumn,
                value: startValue,
                valueGenerator: startColumn.valueSetParams?.valueGenerator,
              });
            }
          }
        }
      }

      // 清理
      isDragging = false;
      startCell = null;
      startNode = null;
      startColumn = null;
      startValue = null;
      document.body.style.cursor = "";
      this.clearDragHighlight();
      document.removeEventListener("mousemove", handleDrag);
      document.removeEventListener("mouseup", handleDragEnd);
    };
  }

  private highlightDragRange(startCell: HTMLElement, endCell: HTMLElement) {
    this.clearDragHighlight();

    // 获取所有需要高亮的单元格
    const startRowEl = startCell.closest(".grid-row");
    const endRowEl = endCell.closest(".grid-row");

    if (!startRowEl || !endRowEl) return;

    const startRowId = startRowEl.getAttribute("data-row-id");
    const endRowId = endRowEl.getAttribute("data-row-id");

    if (!startRowId || !endRowId) return;

    const startField = startCell.getAttribute("data-field");
    const endField = endCell.getAttribute("data-field");

    if (!startField || !endField) return;

    // 获取行和列的索引
    const startNode = this.rowNodes.get(startRowId);
    const endNode = this.rowNodes.get(endRowId);

    if (!startNode || !endNode) return;

    const startColIndex = this.options.columns.findIndex(
      (col) => col.field === startField
    );
    const endColIndex = this.options.columns.findIndex(
      (col) => col.field === endField
    );

    if (startColIndex === -1 || endColIndex === -1) return;

    // 计算范围
    const minRowIndex = Math.min(startNode.rowIndex, endNode.rowIndex);
    const maxRowIndex = Math.max(startNode.rowIndex, endNode.rowIndex);
    const minColIndex = Math.min(startColIndex, endColIndex);
    const maxColIndex = Math.max(startColIndex, endColIndex);

    // 获取所有行
    const rows = this.element.querySelectorAll(".grid-row");

    // 为范围内的每个单元格添加高亮类
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] as HTMLElement;
      const rowId = row.getAttribute("data-row-id");
      if (!rowId) continue;

      const node = this.rowNodes.get(rowId);
      if (!node) continue;

      // 如果行在范围内
      if (node.rowIndex >= minRowIndex && node.rowIndex <= maxRowIndex) {
        const cells = row.querySelectorAll(".grid-cell");

        for (let j = 0; j < cells.length; j++) {
          const cell = cells[j] as HTMLElement;
          const field = cell.getAttribute("data-field");
          if (!field) continue;

          const colIndex = this.options.columns.findIndex(
            (col) => col.field === field
          );
          if (colIndex === -1) continue;

          // 如果单元格在范围内
          if (colIndex >= minColIndex && colIndex <= maxColIndex) {
            cell.classList.add("grid-cell-drag-selected");

            // 添加边框类，根据位置添加不同的边框样式
            if (node.rowIndex === minRowIndex) {
              cell.classList.add("grid-cell-drag-top");
            }
            if (node.rowIndex === maxRowIndex) {
              cell.classList.add("grid-cell-drag-bottom");
            }
            if (colIndex === minColIndex) {
              cell.classList.add("grid-cell-drag-left");
            }
            if (colIndex === maxColIndex) {
              cell.classList.add("grid-cell-drag-right");
            }
          }
        }
      }
    }
  }

  private clearDragHighlight() {
    // 移除所有单元格的高亮类
    const selectedCells = this.element.querySelectorAll(
      ".grid-cell-drag-selected"
    );
    selectedCells.forEach((cell) => {
      cell.classList.remove(
        "grid-cell-drag-selected",
        "grid-cell-drag-top",
        "grid-cell-drag-bottom",
        "grid-cell-drag-left",
        "grid-cell-drag-right"
      );
    });
  }

  // 实现 GridApi 的批量赋值方法
  setValues(params: ValueSetParams): void {
    const {
      startNode,
      startColumn,
      endNode,
      endColumn,
      value,
      valueGenerator,
    } = params;

    if (!startNode || !endNode || !startColumn || !endColumn) {
      return;
    }

    this.saveScrollPosition();

    const minRowIndex = Math.min(startNode.rowIndex, endNode.rowIndex);
    const maxRowIndex = Math.max(startNode.rowIndex, endNode.rowIndex);
    const minColIndex = this.options.columns.indexOf(startColumn);
    const maxColIndex = this.options.columns.indexOf(endColumn);

    if (minColIndex === -1 || maxColIndex === -1) {
      return;
    }

    // Get all row nodes sorted by row index
    const allNodes: RowNode[] = [];
    this.rowNodes.forEach(node => {
      allNodes.push(node);
    });
    
    // Sort by row index
    allNodes.sort((a, b) => a.rowIndex - b.rowIndex);
    
    // Filter to only nodes within our range
    const targetNodes = allNodes.filter(
      node => node.rowIndex >= minRowIndex && node.rowIndex <= maxRowIndex
    );

    // Go through each node and update applicable columns
    targetNodes.forEach(node => {
      for (let colIndex = minColIndex; colIndex <= maxColIndex; colIndex++) {
        const column = this.options.columns[colIndex];
        if (!column) continue;
        
        // Skip non-editable columns
        if (column.editable === false) continue;

        const oldValue = node.data[column.field];
        const finalValue = valueGenerator
          ? valueGenerator({
              rowIndex: node.rowIndex,
              colId: column.field,
              originalValue: oldValue,
              startValue: value,
            })
          : value;

        // Update the data model
        node.data[column.field] = finalValue;

        // Trigger callbacks
        if (this.options.onCellValueChanged) {
          this.options.onCellValueChanged({
            node,
            data: node.data,
            column,
            colId: column.field,
            value: finalValue,
            oldValue,
            newValue: finalValue,
            event: new MouseEvent("click"),
          });
        }
      }
    });

    this.refreshView();
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
    const movedNode = this.dataManager.moveRow(fromIndex, toIndex);
    
    if (movedNode && this.options.onRowDragEnd) {
      this.options.onRowDragEnd({
        node: movedNode,
        data: movedNode.data,
        fromIndex,
        toIndex,
        event: new MouseEvent("dragend"),
      });
    }
    
    // 确保清理拖拽样式
    this.clearDragStyles();
    
    this.refreshView();
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

    if (this.virtualDOM) {
      this.virtualDOM.clear();
    }
    this.eventManager.clear();

    // 清理drag and drop监听器
    this.element.removeEventListener(
      "dragstart",
      this.handleDragStart.bind(this)
    );
    this.element.removeEventListener(
      "dragover",
      this.handleDragOver.bind(this)
    );
    this.element.removeEventListener("drop", this.handleDrop.bind(this));
    this.element.removeEventListener("dragend", this.handleDragEnd.bind(this));
  }

  /**
   * 获取组件管理器
   * @returns ComponentManager实例
   */
  getComponentManager(): ComponentManager {
    return this.componentManager;
  }
}
