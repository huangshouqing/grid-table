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
    // 列拖拽事件 - 只注册一次dragstart，根据元素类型分别处理
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
    // 专门为行拖拽注册事件
    this.element.addEventListener("dragstart", this.handleRowDragStart);
    this.element.addEventListener("dragover", this.handleRowDragOver);
    this.element.addEventListener("drop", this.handleRowDrop);
    this.element.addEventListener("dragend", this.handleRowDragEnd);
  }
  
  /**
   * 处理行拖拽开始事件
   */
  public handleRowDragStart = (e: DragEvent): void => {
    // 只处理来自拖拽句柄的事件
    const dragHandle = (e.target as HTMLElement).closest('.grid-row-drag-handle');
    if (!dragHandle || !e.dataTransfer) {
      return;
    }
    
    // 行拖拽由RowDragRenderer设置数据，这里不需要额外操作
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
    
    // 检查是否是行拖拽数据
    if (!e.dataTransfer.types.includes('application/grid-row') && 
        !e.dataTransfer.types.includes('application/json')) {
      return;
    }
    
    try {
      // 优先使用专用的行拖拽数据格式
      let jsonData = '';
      if (e.dataTransfer.types.includes('application/grid-row')) {
        jsonData = e.dataTransfer.getData('application/grid-row');
      } else {
        jsonData = e.dataTransfer.getData('application/json');
      }
      
      // 检查数据非空
      if (!jsonData || jsonData.trim() === '') {
        return;
      }
      
      // 解析拖拽数据
      const dragData = JSON.parse(jsonData);
      
      // 验证这是行拖拽数据
      if (!dragData || typeof dragData !== 'object' || 
          (dragData.isColumn === true) || // 排除列拖拽 
          !('rowIndex' in dragData)) {
        return;
      }
      
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
    // 检查是否是行拖拽元素（使用className判断）
    const rowDragHandle = (e.target as HTMLElement).closest(".grid-row-drag-handle");
    if (rowDragHandle) {
      // 这是行拖拽，不在这里处理
      return;
    }

    const element = (e.target as HTMLElement).closest(".grid-header-cell");
    if (!element || !e.dataTransfer) {
      return;
    }
    
    // 检查元素是否设置为可拖拽
    const draggableAttr = element.getAttribute('draggable');
    if (draggableAttr !== 'true') {
      return;
    }

    const field = (element as HTMLElement).dataset.field;
    if (!field) {
      return;
    }

    const column = this.options.columns.find((c) => c.field === field);
    if (!column) {
      return;
    }
    
    if (column.draggable === false) {
      return;
    }
    
    this.state.dragState.draggedColumn = column;
    this.state.dragState.draggedElement = element as HTMLElement;

    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", column.field);
    
    try {
      // 添加自定义数据类型以区分拖拽类型
      const columnData = {
        field: column.field,
        isColumn: true
      };
      e.dataTransfer.setData("application/grid-column", JSON.stringify(columnData));
    } catch (error) {
      // 忽略设置拖拽数据时的错误
    }

    element.classList.add("dragging");
  };

  /**
   * 处理列头拖拽经过事件
   */
  public handleDragOver = (e: DragEvent): void => {
    // 如果不是列拖拽，不处理
    if (e.dataTransfer && !e.dataTransfer.types.includes('application/grid-column')) {
      return;
    }
    
    const element = (e.target as HTMLElement).closest(".grid-header-cell");
    if (!element) return;
    
    // 检查是否允许放置
    const field = (element as HTMLElement).dataset.field;
    if (!field) return;
    
    const column = this.options.columns.find(c => c.field === field);
    if (!column || column.rowDrag || column.checkboxSelection) {
      // 不允许拖放到特殊列
      return;
    }

    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "move";
    }
    
    // 添加视觉反馈
    this.clearDragStyles();
    element.classList.add("grid-column-drop-target");
  };

  /**
   * 处理列头拖拽放置事件
   */
  public handleDrop = (e: DragEvent): void => {
    e.preventDefault();
    
    if (!e.dataTransfer) {
      return;
    }
    
    // 调试：显示所有可用的数据类型
    
    // 检查是否是列拖拽
    const isColumnDrag = e.dataTransfer.types.includes('application/grid-column');
    if (!isColumnDrag) {
      return;
    }
    
    try {
      // 获取拖拽数据
      const jsonData = e.dataTransfer.getData('application/grid-column');
      if (!jsonData) {
        return;
      }
      
      const columnData = JSON.parse(jsonData);
      
      if (!columnData || !columnData.isColumn) {
        return;
      }
      
      const targetElement = (e.target as HTMLElement).closest(".grid-header-cell");
      if (!targetElement) {
        return;
      }

      const field = (targetElement as HTMLElement).dataset.field;
      if (!field) {
        return;
      }

      const targetColumn = this.options.columns.find((c) => c.field === field);
      if (!targetColumn) {
        return;
      }
      
      const { draggedColumn } = this.state.dragState;
      if (!draggedColumn) {
        return;
      }
      
      if (draggedColumn === targetColumn) {
        return;
      }

      // 检查目标列是否可作为拖拽目标
      if (targetColumn.rowDrag || targetColumn.checkboxSelection) {
        return;
      }

      const sourceIndex = this.options.columns.indexOf(draggedColumn);
      const targetIndex = this.options.columns.indexOf(targetColumn);

      if (sourceIndex === -1 || targetIndex === -1) {
        return;
      }
      
      // 执行列移动

      // 创建列数组副本并执行移动
      const columns = [...this.options.columns];
      columns.splice(sourceIndex, 1);
      columns.splice(targetIndex, 0, draggedColumn);

      // 重要：创建一个新的副本，确保引用改变
      // 直接修改 options.columns 可能不会触发更新
      const newColumns = [...columns];
      
      // 验证新的列顺序
      console.log("New column order:", newColumns.map(c => c.field).join(", "));
      
      // 完全替换列定义，确保引用改变
      this.options.columns = newColumns;

      // 清理拖拽样式
      this.clearDragStyles();

      // 强制完全重新渲染表格
      // 这很关键，确保视图与新的列顺序保持同步
      this.refreshView();
      
      // 如果有onColumnMoved回调，触发它
      if (this.options.onColumnMoved) {
        this.options.onColumnMoved({
          column: draggedColumn,
          fromIndex: sourceIndex,
          toIndex: targetIndex
        });
      }
    } catch (error) {
      // 捕获处理列拖放时的任何错误
    }
  };

  /**
   * 处理列头拖拽结束事件
   */
  public handleDragEnd = (e: DragEvent): void => {
    // 如果没有dataTransfer或者不是列拖拽，可能是其他类型的拖拽，直接返回
    if (!e.dataTransfer) {
      return;
    }
    
    // 检查是否有设置draggedColumn，无论是否有数据类型标记
    if (this.state.dragState.draggedColumn) {
      // 清理状态
      const { draggedElement } = this.state.dragState;
      if (draggedElement) {
        draggedElement.classList.remove("dragging");
      }
      this.state.dragState.draggedColumn = null;
      this.state.dragState.draggedElement = null;
    }
    
    // 总是清理所有拖拽相关样式
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
      // 清理行拖拽样式
      const allRows = this.element.querySelectorAll(".grid-row");
      allRows.forEach((row) => {
        row.classList.remove(
          "grid-row-drag-above",
          "grid-row-drag-below",
          "grid-row-dragging"
        );
      });
      
      // 清理列拖拽样式
      const allHeaderCells = this.element.querySelectorAll(".grid-header-cell");
      allHeaderCells.forEach((cell) => {
        cell.classList.remove(
          "dragging",
          "grid-column-drop-target"
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
    this.element.removeEventListener("dragstart", this.handleRowDragStart);
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