import { VirtualDOMManager } from "./VirtualDOMManager";
import { Column, GridApi, GridOptions, RowNode, ValueSetParams } from "../types";
import { GridState } from "../interface";
import { GridDataManager } from "./GridDataManager";

/**
 * GridDragDropManager - 负责管理表格的拖拽和拖放功能
 * 包括行拖拽、列拖拽、单元格拖放和拖拽填充等功能
 */
export class GridDragDropManager {
  private element: HTMLElement;
  private virtualDOM: VirtualDOMManager;
  private state: GridState;
  private options: GridOptions;
  private rowNodes: Map<string | number, RowNode>;
  private getApi: () => GridApi;
  private dataManager: GridDataManager;
  private _dragOverAnimFrame: number | null = null;
  private refreshView: () => void;

  constructor(
    element: HTMLElement,
    virtualDOM: VirtualDOMManager,
    state: GridState,
    options: GridOptions,
    rowNodes: Map<string | number, RowNode>,
    getApi: () => GridApi,
    dataManager: GridDataManager,
    refreshView: () => void
  ) {
    this.element = element;
    this.virtualDOM = virtualDOM;
    this.state = state;
    this.options = options;
    this.rowNodes = rowNodes;
    this.getApi = getApi;
    this.dataManager = dataManager;
    this.refreshView = refreshView;
    this._dragOverAnimFrame = null;
  }

  /**
   * 初始化所有拖拽相关的事件监听器
   */
  public initializeDragAndDropListeners(): void {
    // 初始化列拖拽事件
    this.element.addEventListener("dragstart", this.handleDragStart);
    this.element.addEventListener("dragover", this.handleDragOver);
    this.element.addEventListener("drop", this.handleDrop);
    this.element.addEventListener("dragend", this.handleDragEnd);

    // 初始化拖拽填充功能
    this.initializeDragToFill();

    // 如果开启了行拖拽，初始化行拖拽事件
    if (this.options.enableRowDrag) {
      this.initializeRowDragEvents();
    }
  }

  /**
   * 初始化行拖拽事件
   */
  private initializeRowDragEvents(): void {
    this.element.addEventListener("dragover", this.handleRowDragOver);
    this.element.addEventListener("drop", this.handleRowDrop);
    this.element.addEventListener("dragend", this.handleRowDragEnd);
  }

  /**
   * 处理行拖拽经过事件
   */
  public handleRowDragOver = (e: DragEvent): void => {
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
      this.clearDragStyles();

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

  /**
   * 处理行拖拽放置事件
   */
  public handleRowDrop = (e: DragEvent): void => {
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

  /**
   * 处理行拖拽结束事件
   */
  public handleRowDragEnd = (): void => {
    // 移除所有拖拽指示器
    this.clearDragStyles();
  };

  /**
   * 处理列头拖拽开始事件
   */
  public handleDragStart = (e: DragEvent): void => {
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
  };

  /**
   * 处理列头拖拽经过事件
   */
  public handleDragOver = (e: DragEvent): void => {
    const element = (e.target as HTMLElement).closest(".grid-header-cell");
    if (!element) return;

    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "move";
    }
  };

  /**
   * 处理列头拖拽放置事件
   */
  public handleDrop = (e: DragEvent): void => {
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
  };

  /**
   * 处理列头拖拽结束事件
   */
  public handleDragEnd = (): void => {
    const { draggedElement } = this.state.dragState;
    if (draggedElement) {
      draggedElement.classList.remove("dragging");
    }
    this.state.dragState.draggedColumn = null;
    this.state.dragState.draggedElement = null;
    
    // 清理所有拖拽相关样式
    this.clearDragStyles();
  };

  /**
   * 处理列宽调整开始事件
   */
  public handleResizeStart = (
    e: MouseEvent,
    column: Column,
    element: HTMLElement
  ): void => {
    e.preventDefault();
    this.state.dragState.resizeStartX = e.clientX;
    this.state.dragState.resizeColumn = column;
    this.state.dragState.resizeElement = element;
    document.body.style.cursor = "col-resize";

    // 添加全局鼠标事件监听
    document.addEventListener("mousemove", this.handleResizeMove);
    document.addEventListener("mouseup", this.handleResizeEnd);
  };

  /**
   * 处理列宽调整移动事件
   */
  public handleResizeMove = (e: MouseEvent): void => {
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

  /**
   * 处理列宽调整结束事件
   */
  public handleResizeEnd = (): void => {
    this.state.dragState.resizeColumn = null;
    this.state.dragState.resizeElement = null;
    document.body.style.cursor = "";

    // 移除全局鼠标事件监听
    document.removeEventListener("mousemove", this.handleResizeMove);
    document.removeEventListener("mouseup", this.handleResizeEnd);
  };

  /**
   * 初始化拖拽填充功能
   */
  public initializeDragToFill(): void {
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

  /**
   * 设置单元格值（用于拖拽填充）
   */
  public setValues(params: ValueSetParams): void {
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

    const minRowIndex = Math.min(startNode.rowIndex, endNode.rowIndex);
    const maxRowIndex = Math.max(startNode.rowIndex, endNode.rowIndex);
    const minColIndex = this.options.columns.indexOf(startColumn);
    const maxColIndex = this.options.columns.indexOf(endColumn);

    if (minColIndex === -1 || maxColIndex === -1) {
      return;
    }

    // 获取所有行节点并按行索引排序
    const allNodes: RowNode[] = [];
    this.rowNodes.forEach(node => {
      allNodes.push(node);
    });
    
    allNodes.sort((a, b) => a.rowIndex - b.rowIndex);
    
    // 过滤出范围内的节点
    const targetNodes = allNodes.filter(
      node => node.rowIndex >= minRowIndex && node.rowIndex <= maxRowIndex
    );

    // 遍历每个节点和列，更新值
    targetNodes.forEach(node => {
      for (let colIndex = minColIndex; colIndex <= maxColIndex; colIndex++) {
        const column = this.options.columns[colIndex];
        if (!column) continue;
        
        // 跳过不可编辑的列
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

        // 更新数据模型
        node.data[column.field] = finalValue;

        // 触发回调
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
  }

  /**
   * 高亮拖拽范围的单元格
   */
  public highlightDragRange(startCell: HTMLElement, endCell: HTMLElement): void {
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

  /**
   * 清除拖拽高亮样式
   */
  public clearDragHighlight(): void {
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

  /**
   * 清理所有拖拽相关样式
   */
  public clearDragStyles(): void {
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
      
      // 同时清理单元格拖拽样式
      this.clearDragHighlight();
    });
  }

  /**
   * 移动行（通过数据管理器）
   */
  public moveRow(fromIndex: number, toIndex: number): void {
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

  /**
   * 清理和销毁
   */
  public destroy(): void {
    // 移除行拖拽事件监听
    this.element.removeEventListener("dragover", this.handleRowDragOver);
    this.element.removeEventListener("drop", this.handleRowDrop);
    this.element.removeEventListener("dragend", this.handleRowDragEnd);

    // 移除列拖拽事件监听
    this.element.removeEventListener("dragstart", this.handleDragStart);
    this.element.removeEventListener("dragover", this.handleDragOver);
    this.element.removeEventListener("drop", this.handleDrop);
    this.element.removeEventListener("dragend", this.handleDragEnd);
    
    // 取消任何挂起的动画帧
    if (this._dragOverAnimFrame) {
      cancelAnimationFrame(this._dragOverAnimFrame);
      this._dragOverAnimFrame = null;
    }
    
    // 清理样式
    this.clearDragStyles();
  }
} 