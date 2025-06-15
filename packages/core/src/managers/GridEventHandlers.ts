import { GridState } from "../interface";
import { Column, GridOptions, RowNode, GridApi } from "../types";
import { GridEditManager } from "./GridEditManager";

export class GridEventHandlers {
  private state: GridState;
  private options: GridOptions;
  private rowNodes: Map<string | number, RowNode>;
  private getApi: () => GridApi;
  private editManager: GridEditManager;
  private refreshView: () => void;

  constructor(
    state: GridState,
    options: GridOptions,
    rowNodes: Map<string | number, RowNode>,
    getApi: () => GridApi,
    editManager: GridEditManager,
    refreshView: () => void
  ) {
    this.state = state;
    this.options = options;
    this.rowNodes = rowNodes;
    this.getApi = getApi;
    this.editManager = editManager;
    this.refreshView = refreshView;
  }

  handleScroll = (scrollLeft: number, scrollTop: number) => {
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

  handleSelectionChange = () => {
    this.refreshView();
  };

  handleSortChange = () => {
    this.refreshView();
  };

  handleFilterChange = () => {
    this.refreshView();
  };

  handleEditStart = (params: any) => {
    this.editManager.handleEditStart(params);
    this.refreshView();
  };

  handleEditEnd = (save: boolean) => {
    this.editManager.handleEditEnd(save);
    this.refreshView();
  };

  handleRowClick = (e: MouseEvent, row: any, rowIndex: number) => {
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
    rowIndex: number
  ) => {
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