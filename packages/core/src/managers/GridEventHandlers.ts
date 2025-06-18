import { GridState } from "../interface";
import { Column, GridOptions, RowNode, GridApi } from "../types";
import { GridEditManager } from "./GridEditManager";
import { EventBus } from "../eventbus/EventBus";

/**
 * 表格事件处理器类
 * 负责处理表格的各种事件
 */
export class GridEventHandlers {
  private state: GridState;
  private options: GridOptions;
  private rowNodes: Map<string | number, RowNode>;
  private getApi: () => GridApi;
  private editManager: GridEditManager;
  private refreshView: () => void;
  private eventBus?: EventBus;
  
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
    editEnd: 0
  };
  
  // 调试模式
  private debug: boolean = false;

  constructor(
    state: GridState,
    options: GridOptions,
    rowNodes: Map<string | number, RowNode>,
    getApi: () => GridApi,
    editManager: GridEditManager,
    refreshView: () => void,
    eventBus?: EventBus,
    debug: boolean = false
  ) {
    this.state = state;
    this.options = options;
    this.rowNodes = rowNodes;
    this.getApi = getApi;
    this.editManager = editManager;
    this.refreshView = refreshView;
    this.eventBus = eventBus;
    this.debug = debug;
    
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
    Object.keys(this.eventCounts).forEach(key => {
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
      console.log(`[GridEventHandlers] ${eventType} 事件触发，计数: ${this.eventCounts[eventType]}`, data);
    }
    
    // 通过事件总线发布事件
    if (this.eventBus) {
      this.eventBus.publish('gridEvent', {
        type: eventType,
        count: this.eventCounts[eventType],
        data
      });
    }
  }

  handleScroll = (scrollLeft: number, scrollTop: number) => {
    this.logEvent('scroll', { scrollLeft, scrollTop });
    // 保存当前的滚动位置
    this.state.scrollPosition = {
      top: scrollTop,
      left: scrollLeft,
      lastLeft: this.state.scrollPosition.left,
      lastTop: this.state.scrollPosition.top,
    };
  };

  handleSelectionChange = () => {
    this.logEvent('selectionChange');
    this.refreshView();
  };

  handleSortChange = () => {
    this.logEvent('sortChange');
    this.refreshView();
  };

  handleFilterChange = () => {
    this.logEvent('filterChange');
    this.refreshView();
  };

  handleEditStart = (params: any) => {
    this.logEvent('editStart', params);
    this.editManager.handleEditStart(params);
    this.refreshView();
  };

  handleEditEnd = (save: boolean) => {
    this.logEvent('editEnd', { save });
    this.editManager.handleEditEnd(save);
    this.refreshView();
  };

  handleRowClick = (e: MouseEvent, row: any, rowIndex: number) => {
    this.logEvent('rowClick', { rowId: row.id, rowIndex });
    
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
    this.logEvent('rowDoubleClick', { rowId: row.id, rowIndex });
    
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
    this.logEvent('cellClick', { 
      rowId: row.id, 
      rowIndex, 
      colId: column.field 
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
    this.logEvent('cellDoubleClick', { 
      rowId: row.id, 
      rowIndex, 
      colId: column.field 
    });
    
    // 如果列是可编辑的，则启动编辑
    if (column.editable) {
      this.startEditing(cellElement, column, row, value);
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

  startEditing = (
    cell: HTMLElement,
    column: Column,
    row: any,
    value: any
  ) => {
    this.editManager.startEditing(cell, column, row, value);
  };
} 