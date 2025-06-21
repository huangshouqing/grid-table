import { GridState } from "../interface";
import { Column, GridOptions, RowNode, GridApi } from "../types";
import { GridEditManager } from "./GridEditManager";
import { EventBus } from "../eventbus/EventBus";
import { VirtualDOMManager } from "./VirtualDOMManager";
import { Grid } from "../grid";

/**
 * 表格事件处理器类
 * 负责处理表格的各种事件
 */
export class GridEventHandlers {
  private grid: Grid;
  private state: GridState;
  private options: GridOptions;
  private rowNodes: Map<string | number, RowNode>;
  private getApi: () => GridApi;
  private editManager: GridEditManager;
  private refreshView: (options?: { preserveDOM?: boolean }) => void;
  private eventBus?: EventBus;
  private scheduleRender?: () => void;
  private scrollEndTimer?: any;
  private virtualDOM?: VirtualDOMManager;

  // 事件计数器，用于调试
  private eventCounts: { [key: string]: number } = {
    rowClick: 0,
    rowDoubleClick: 0,
    cellClick: 0,
    cellDoubleClick: 0,
    scroll: 0,
    selectionChange: 0,
    sortChange: 0,
    filterChange: 0,
    editStart: 0,
    editEnd: 0,
  };

  // 调试模式
  private debug: boolean = false;

  constructor(
    grid: Grid,
    state: GridState,
    options: GridOptions,
    rowNodes: Map<string | number, RowNode>,
    getApi: () => GridApi,
    editManager: GridEditManager,
    refreshView: (options?: { preserveDOM?: boolean }) => void,
    virtualDOM: VirtualDOMManager,
    eventBus?: EventBus,
    scheduleRender?: () => void,
    debug: boolean = false
  ) {
    this.grid = grid;
    this.state = state;
    this.options = options;
    this.rowNodes = rowNodes;
    this.getApi = getApi;
    this.editManager = editManager;
    this.refreshView = refreshView;
    this.eventBus = eventBus;
    this.scheduleRender = scheduleRender;
    this.debug = debug;
    this.virtualDOM = virtualDOM;

    // 绑定所有方法，确保this引用正确
    this.handleRowClick = this.handleRowClick.bind(this);
    this.handleRowDoubleClick = this.handleRowDoubleClick.bind(this);
    this.handleCellClick = this.handleCellClick.bind(this);
    this.handleCellDoubleClick = this.handleCellDoubleClick.bind(this);
    this.handleScroll = this.handleScroll.bind(this);
    this.handleSelectionChange = this.handleSelectionChange.bind(this);
    this.handleSortChange = this.handleSortChange.bind(this);
    this.handleFilterChange = this.handleFilterChange.bind(this);
    this.handleEditStart = this.handleEditStart.bind(this);
    this.handleEditEnd = this.handleEditEnd.bind(this);
    this.startEditing = this.startEditing.bind(this);
  }

  /**
   * 设置调试模式
   */
  setDebugMode(enabled: boolean): void {
    this.debug = enabled;
  }

  /**
   * 获取事件计数
   */
  getEventCounts(): { [key: string]: number } {
    return { ...this.eventCounts };
  }

  /**
   * 重置事件计数器
   */
  resetEventCounts(): void {
    Object.keys(this.eventCounts).forEach((key) => {
      this.eventCounts[key] = 0;
    });
  }

  /**
   * 记录事件触发
   */
  private logEvent(eventType: string, data?: any): void {
    if (this.eventCounts[eventType] !== undefined) {
      this.eventCounts[eventType]++;
    }

    if (this.debug) {
      console.log(
        `[GridEventHandlers] ${eventType} 事件触发，计数: ${this.eventCounts[eventType]}`,
        data
      );
    }

    // 通过事件总线发布事件
    if (this.eventBus) {
      this.eventBus.publish("gridEvent", {
        type: eventType,
        count: this.eventCounts[eventType],
        data,
      });
    }
  }

  handleScroll = (scrollLeft: number, scrollTop: number) => {
    // 检查滚动位置是否有变化，避免不必要的计算
    if (
      this.state.scrollPosition.top === scrollTop &&
      this.state.scrollPosition.left === scrollLeft
    ) {
      return;
    }

    this.logEvent("scroll", { scrollLeft, scrollTop });
    // 更新滚动位置
    this.state.scrollPosition = {
      ...this.state.scrollPosition,
      top: scrollTop,
      left: scrollLeft,
      lastTop: this.state.scrollPosition.top,
      lastLeft: this.state.scrollPosition.left
    };

    // 清除之前的定时器
    if (this.scrollEndTimer) {
      clearTimeout(this.scrollEndTimer);
    }

    // 设置延迟触发的滚动结束事件，确保不会频繁重新渲染
    this.scrollEndTimer = setTimeout(() => {
      if (this.eventBus) {
        this.eventBus.publish("gridScrollEnd", {
          type: "scrollEnd",
          position: {
            top: scrollTop,
            left: scrollLeft
          }
        });
      }

      // 根据需要触发渲染，确保新的可见区域内容被渲染
      if (this.scheduleRender) {
        this.scheduleRender();
      }
    }, 100);
  };

  handleSelectionChange = (e: any) => {
    // 处理选择变化的逻辑
    this.logEvent("selectionChange", e.detail);
  };

  handleSortChange = (e: any) => {
    // 处理排序变化的逻辑
    this.logEvent("sortChange", e.detail);
    this.refreshView();
  };

  handleFilterChange = (e: any) => {
    // 处理过滤变化的逻辑
    this.logEvent("filterChange", e.detail);
    this.refreshView();
  };

  handleEditStart = (e: any) => {
    // 处理编辑开始的逻辑
    this.logEvent("editStart", e.detail);
  };

  handleEditEnd = (e: any) => {
    // 处理编辑结束的逻辑
    this.logEvent("editEnd", e.detail);
  };

  handleRowClick = (e: MouseEvent, row: any, rowIndex: number) => {
    this.logEvent("rowClick", { row, rowIndex });

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
  };

  handleRowDoubleClick = (e: MouseEvent, row: any, rowIndex: number) => {
    this.logEvent("rowDoubleClick", { row, rowIndex });

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
  };

  handleCellClick = (
    e: MouseEvent,
    column: Column,
    row: any,
    value: any,
    rowIndex: number
  ) => {
    this.logEvent("cellClick", {
      rowId: row.id,
      rowIndex,
      colId: column.field,
    });

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
  };

  handleCellDoubleClick = (
    e: MouseEvent,
    column: Column,
    row: any,
    value: any,
    rowIndex: number,
    cellElement: HTMLElement
  ) => {
    this.logEvent("cellDoubleClick", {
      rowId: row.id,
      rowIndex,
      colId: column.field,
    });

    // 如果列是可编辑的，则启动编辑
    if (column.editable) {
      if (this.eventBus) {
        // 通过事件总线发布单元格编辑请求事件
        this.eventBus.publish("gridCellAction", {
          type: "cellEditRequest",
          rowId: row.id,
          rowIndex: rowIndex,
          colId: column.field,
          field: column.field,
          value: value,
          cellElement: cellElement,
          source: "cellDoubleClick",
        });
      } else {
        // 降级处理：直接调用编辑方法
        this.startEditing(cellElement, column, row, value);
      }
    }

    // 触发现有的双击事件回调
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
  };

  startEditing = (cell: HTMLElement, column: Column, row: any, value: any) => {
    const rowNode = this.rowNodes.get(row.id);
    if (rowNode) {
      this.editManager.startEditing(cell, column, rowNode, value);
    }
  };
}
