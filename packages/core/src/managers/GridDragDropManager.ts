import { VirtualDOMManager } from "./VirtualDOMManager";
import {
  Column,
  GridApi,
  GridOptions,
  RowNode,
} from "../types";
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
  // 新增，用于获取分离后的列
  private getLeftPinnedColumns: () => Column[];
  private getCenterColumns: () => Column[];
  private getRightPinnedColumns: () => Column[];

  constructor(
    element: HTMLElement,
    virtualDOM: VirtualDOMManager,
    state: GridState,
    options: GridOptions,
    rowNodes: Map<string | number, RowNode>,
    getApi: () => GridApi,
    dataManager: GridDataManager,
    refreshView: () => void,
    // 新增构造函数参数
    getLeftPinnedColumns: () => Column[],
    getCenterColumns: () => Column[],
    getRightPinnedColumns: () => Column[]
  ) {
    this.element = element;
    this.virtualDOM = virtualDOM;
    this.state = state;
    this.options = options;
    this.rowNodes = rowNodes;
    this.getApi = getApi;
    this.dataManager = dataManager;

    // 包装 refreshView 函数，在视图刷新后添加拖动句柄
    const originalRefreshView = refreshView;
    this.refreshView = () => {
      originalRefreshView();
    };

    this._dragOverAnimFrame = null;
    // 初始化新增属性
    this.getLeftPinnedColumns = getLeftPinnedColumns;
    this.getCenterColumns = getCenterColumns;
    this.getRightPinnedColumns = getRightPinnedColumns;
  }

  /**
   * 初始化所有拖拽相关的事件监听器
   */
  public initializeDragAndDropListeners(): void {
    // 统一的拖拽事件监听器
    this.element.addEventListener("dragstart", this.handleDragStart);
    this.element.addEventListener("dragover", this.handleDragOver);
    this.element.addEventListener("drop", this.handleDrop);
    this.element.addEventListener("dragend", this.handleDragEnd);

    // 初始化拖拽填充功能
    this.initializeDragToFill();
  }

  /**
   * 处理拖拽经过事件(路由)
   */
  public handleDragOver = (e: DragEvent): void => {
    if (e.dataTransfer?.types.includes("application/grid-row")) {
      this.handleRowDragOver(e);
    } else if (this.state.dragState.draggedColumn) {
      this.handleColumnDragOver(e);
    }
  };

  /**
   * 处理放置事件(路由)
   */
  public handleDrop = (e: DragEvent): void => {
    if (e.dataTransfer?.types.includes("application/grid-row")) {
      this.handleRowDrop(e);
    } else {
      this.handleColumnDrop(e);
    }
  };

  /**
   * 处理拖拽结束事件(路由)
   */
  public handleDragEnd = (e: DragEvent): void => {
    // 对两种情况都进行清理
    this.handleRowDragEnd();
    this.handleColumnDragEnd();
  };

  /**
   * 处理行拖拽经过事件
   */
  private handleRowDragOver = (e: DragEvent): void => {
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
  private handleRowDrop = (e: DragEvent): void => {
    e.preventDefault();
    if (!e.dataTransfer) {
      this.clearDragStyles();
      return;
    }

    try {
      // 优先使用专用的行拖拽数据格式
      let jsonData = e.dataTransfer.getData("application/grid-row");

      // 检查数据非空
      if (!jsonData || jsonData.trim() === "") {
        this.clearDragStyles();
        return;
      }

      // 解析拖拽数据
      const dragData = JSON.parse(jsonData);

      // 验证这是行拖拽数据
      if (!dragData || !dragData.isRowDrag) {
        this.clearDragStyles();
        return;
      }

      const { rowId } = dragData;
      // console.log(`[handleRowDrop] 开始处理行拖拽，rowId=${rowId}`);

      // 获取目标行
      const targetRow = (e.target as HTMLElement).closest(
        ".grid-row"
      ) as HTMLElement;
      if (!targetRow) {
        this.clearDragStyles();
        return;
      }

      const toRowId = targetRow.getAttribute("data-row-id");
      if (!toRowId || String(rowId) === String(toRowId)) {
        this.clearDragStyles();
        return;
      }

      // 获取当前的行节点，确保使用最新数据
      const fromNode = this.rowNodes.get(rowId);
      const toNode = this.rowNodes.get(this.convertRowId(toRowId));

      if (!fromNode || !toNode) {
        console.warn(
          `[handleRowDrop] 找不到行节点, fromNode=${fromNode}, toNode=${toNode}`
        );
        this.clearDragStyles();
        return;
      }

      // 使用行节点的rowIndex而不是原始数据来确定位置
      const fromIndex = fromNode.rowIndex;
      const toIndex = toNode.rowIndex;

      if (fromIndex === -1 || toIndex === -1) {
        console.warn(
          `[handleRowDrop] 找不到行索引, fromIndex=${fromIndex}, toIndex=${toIndex}`
        );
        this.clearDragStyles();
        return;
      }

      // console.log(`[handleRowDrop] 找到行索引, fromIndex=${fromIndex}, toIndex=${toIndex}`);

      // 确定拖拽位置（上方或下方）
      const rect = targetRow.getBoundingClientRect();
      const middleY = rect.top + rect.height / 2;
      const isBelow = e.clientY > middleY;

      let targetIndex = toIndex;
      if (isBelow) {
        targetIndex++;
        // console.log(`[handleRowDrop] 拖拽到目标行下方，调整targetIndex=${targetIndex}`);
      } else {
        // console.log(`[handleRowDrop] 拖拽到目标行上方，targetIndex=${targetIndex}`);
      }

      // 如果拖拽的行在目标之前，调整目标索引
      if (fromIndex < targetIndex) {
        targetIndex--;
        // console.log(`[handleRowDrop] 拖拽行在目标前面，调整targetIndex=${targetIndex}`);
      }

      // console.log(`[handleRowDrop] 最终移动：从${fromIndex}到${targetIndex}`);

      // 移动行
      const movedNode = this.dataManager.moveRow(fromIndex, targetIndex);
      if (!movedNode) {
        console.warn(`[handleRowDrop] 移动行失败`);
      } else {
        // console.log(`[handleRowDrop] 移动成功，行ID=${movedNode.id}, 新索引=${movedNode.rowIndex}`);
      }

      // 移除所有拖拽指示器
      this.clearDragStyles();

      // 触发行拖拽结束事件
      if (this.options.onRowDragEnd && movedNode) {
        this.options.onRowDragEnd({
          node: movedNode,
          data: movedNode.data,
          fromIndex,
          toIndex: targetIndex,
          event: e,
        });
      }

      // 刷新视图
      this.refreshView();
    } catch (error) {
      console.error("Error handling row drop:", error);
      this.clearDragStyles();
    }
  };

  /**
   * 处理行拖拽结束事件
   */
  private handleRowDragEnd = (): void => {
    // 移除所有拖拽指示器
    this.clearDragStyles();
  };

  /**
   * 处理列头拖拽开始事件
   */
  public handleDragStart = (e: DragEvent): void => {
    // 检查是否是行拖拽元素（使用className判断）
    const rowDragHandle = (e.target as HTMLElement).closest(
      ".grid-row-drag-handle"
    );
    if (rowDragHandle) {
      // 这是行拖拽，由RowDragRenderer处理，不在这里继续执行
      return;
    }

    const element = (e.target as HTMLElement).closest(".grid-header-cell");
    if (!element || !e.dataTransfer) {
      return;
    }

    // 检查元素是否设置为可拖拽
    const draggableAttr = element.getAttribute("draggable");
    if (draggableAttr !== "true") {
      return;
    }

    const field = (element as HTMLElement).dataset.field;
    if (!field) {
      return;
    }

    // 找出拖拽的列和它的容器
    const container = element.closest(
      ".grid-pinned-container, .grid-center-container"
    );
    let sourceContainer: "left" | "center" | "right" = "center";
    let columnSet = this.getCenterColumns();

    if (container?.classList.contains("grid-pinned-left")) {
      sourceContainer = "left";
      columnSet = this.getLeftPinnedColumns();
    } else if (container?.classList.contains("grid-pinned-right")) {
      sourceContainer = "right";
      columnSet = this.getRightPinnedColumns();
    }

    const column = columnSet.find((c) => c.field === field);
    if (!column || column.draggable === false) {
      return;
    }

    e.dataTransfer.setData(
      "application/json",
      JSON.stringify({
        field: column.field,
        isColumn: true,
        container: sourceContainer,
      })
    );
    e.dataTransfer.effectAllowed = "move";

    this.state.dragState.draggedColumn = column;
    this.state.dragState.draggedElement = element as HTMLElement;
    // 存储源容器
    this.state.dragState.sourceContainer = sourceContainer;

    element.classList.add("dragging");
  };

  /**
   * 处理列拖拽覆盖事件
   */
  private handleColumnDragOver = (e: DragEvent): void => {
    const draggedColumn = this.state.dragState.draggedColumn;
    if (!draggedColumn) {
      return;
    }
    e.preventDefault();

    if (this._dragOverAnimFrame) {
      cancelAnimationFrame(this._dragOverAnimFrame);
    }

    this._dragOverAnimFrame = requestAnimationFrame(() => {
      this.updateDropIndicators(e, draggedColumn);
    });
  };

  /**
   * 处理列放置事件
   */
  private handleColumnDrop = (e: DragEvent): void => {
    e.preventDefault();
    const field = this.state.dragState.draggedColumn?.field;
    if (!field) {
      this.clearDropIndicators();
      return;
    }

    const { draggedColumn, sourceContainer } = this.state.dragState;
    if (!draggedColumn || !sourceContainer) {
      this.clearDropIndicators();
      return;
    }

    const targetCell = (e.target as HTMLElement).closest(
      ".grid-header-cell"
    ) as HTMLElement;

    // 如果没有目标单元格，则表示可能拖到了无效区域
    if (!targetCell) {
      this.clearDropIndicators();
      // 可以在这里处理"移出"逻辑，比如移动到非固定区域
      return;
    }

    const targetField = targetCell.dataset.field;

    // 如果拖到自身或无效目标，则结束
    if (!targetField || targetField === draggedColumn.field) {
      this.clearDropIndicators();
      return;
    }

    // 确定目标容器
    const targetContainerEl = (e.target as HTMLElement).closest(
      ".grid-pinned-container, .grid-center-container"
    );
    let targetContainer: "left" | "center" | "right" = "center";
    if (targetContainerEl) {
      if (targetContainerEl.classList.contains("grid-pinned-left"))
        targetContainer = "left";
      else if (targetContainerEl.classList.contains("grid-pinned-right"))
        targetContainer = "right";
    }

    // 从所有列的映射中获取源列数组并移除拖拽的列
    const allColsMap = {
      left: this.getLeftPinnedColumns(),
      center: this.getCenterColumns(),
      right: this.getRightPinnedColumns(),
    };
    const sourceCols = allColsMap[sourceContainer];
    const dragIndex = sourceCols.findIndex((c) => c.field === field);
    const [movedCol] = sourceCols.splice(dragIndex, 1);

    // 更新列的固定状态
    movedCol.pinned =
      targetContainer === "center" ? undefined : targetContainer;

    // 添加到目标数组中
    const targetCols = allColsMap[targetContainer];
    let targetIndex = targetCols.findIndex(
      (c: Column) => c.field === targetField
    );

    const rect = targetCell.getBoundingClientRect();
    const isRightHalf = e.clientX > rect.left + rect.width / 2;

    if (isRightHalf) {
      targetIndex++;
    }

    targetCols.splice(targetIndex, 0, movedCol);

    // 组合新的完整列定义
    const newColDefs = [
      ...allColsMap.left,
      ...allColsMap.center,
      ...allColsMap.right,
    ];

    this.getApi().setColumnDefs(newColDefs);

    // 清理状态
    this.state.dragState.draggedElement = null;
    this.state.dragState.draggedColumn = null;
    this.clearDropIndicators();
  };

  /**
   * 处理列拖拽结束事件
   */
  private handleColumnDragEnd = (): void => {
    const draggedColumn = this.state.dragState.draggedColumn;
    if (!draggedColumn) {
      return;
    }

    if (this.state.dragState.draggedElement) {
      this.state.dragState.draggedElement.classList.remove("dragging");
    }
    this.state.dragState.draggedElement = null;
    this.state.dragState.draggedColumn = null;
    this.clearDropIndicators();
  };

  /**
   * 处理列宽调整开始事件
   */
  public handleResizeStart = (e: MouseEvent, column: Column): void => {
    // 确定拖拽发生在哪一个容器
    const headerCell = (e.target as HTMLElement).closest(".grid-header-cell");
    const container = headerCell?.closest(
      ".grid-pinned-container, .grid-center-container"
    );

    let columnSet: Column[] = [];
    let containerType: "left" | "center" | "right" = "center";

    if (container?.classList.contains("grid-pinned-left")) {
      columnSet = this.getLeftPinnedColumns();
      containerType = "left";
    } else if (container?.classList.contains("grid-pinned-right")) {
      columnSet = this.getRightPinnedColumns();
      containerType = "right";
    } else {
      columnSet = this.getCenterColumns();
      containerType = "center";
    }

    const resizeGuide = document.createElement("div");
    resizeGuide.className = "resize-guide";
    this.element.appendChild(resizeGuide);

    // 计算初始位置
    const rect = headerCell!.getBoundingClientRect();
    const gridRect = this.element.getBoundingClientRect();
    const initialLeft = rect.right - gridRect.left;
    resizeGuide.style.left = `${initialLeft}px`;

    this.state.dragState = {
      ...this.state.dragState,
      resizeStartX: e.clientX,
      resizeColumn: column,
      initialWidth: column.width,
      activeColumnSet: columnSet,
      activeContainer: containerType,
      resizeGuideElement: resizeGuide,
    };

    document.addEventListener("mousemove", this.handleResizeMove);
    document.addEventListener("mouseup", this.handleResizeEnd);
  };

  /**
   * 处理列宽调整的鼠标移动事件
   */
  public handleResizeMove = (e: MouseEvent): void => {
    const { resizeStartX, resizeGuideElement, resizeColumn, initialWidth } =
      this.state.dragState;
    if (!resizeGuideElement || !resizeColumn || initialWidth === undefined)
      return;

    const deltaX = e.clientX - resizeStartX!;
    const newWidth = initialWidth + deltaX;

    // Check for minimum width and provide feedback
    const minWidth = 50;
    if (newWidth <= minWidth) {
      resizeGuideElement.classList.add("limit-reached");
    } else {
      resizeGuideElement.classList.remove("limit-reached");
    }

    // Move the guide, but don't let it go below the visual minimum
    const headerCell = this.element.querySelector(
      `[data-field="${resizeColumn.field}"]`
    );
    if (headerCell) {
      const rect = headerCell.getBoundingClientRect();
      const gridRect = this.element.getBoundingClientRect();
      const finalWidth = Math.max(minWidth, newWidth);
      resizeGuideElement.style.left = `${
        rect.left - gridRect.left + finalWidth
      }px`;
    }
  };

  /**
   * 处理列宽调整的鼠标结束事件
   */
  public handleResizeEnd = (): void => {
    const {
      resizeStartX,
      resizeColumn,
      initialWidth,
      resizeGuideElement,
    } = this.state.dragState;

    if (resizeGuideElement) {
      resizeGuideElement.remove();
    }

    if (
      resizeColumn &&
      initialWidth !== undefined &&
      resizeStartX !== undefined
    ) {
      const finalX = parseFloat(resizeGuideElement!.style.left);

      const headerCell = this.element.querySelector(
        `[data-field="${resizeColumn.field}"]`
      ) as HTMLElement;
      const rect = headerCell.getBoundingClientRect();
      const gridRect = this.element.getBoundingClientRect();
      const startX = rect.left - gridRect.left;

      const newWidth = finalX - startX;

      // 保存当前的滚动位置，以便在列宽改变后恢复
      const centerBody = this.element.querySelector('.grid-center-container .grid-body') as HTMLElement;
      const scrollPosition = {
        top: centerBody?.scrollTop || 0,
        left: centerBody?.scrollLeft || 0
      };

      // 获取事件总线
      const api = this.getApi();
      const eventBus = api.getEventBus();

      // 通过事件总线发布列宽调整请求
      if (eventBus) {
        eventBus.publish('gridUIAction', {
          type: 'columnResizeRequest',
          colId: resizeColumn.field,
          width: Math.max(50, newWidth),
          source: 'columnResizer',
          scrollPosition: scrollPosition
        });
      }
    }

    document.removeEventListener("mousemove", this.handleResizeMove);
    document.removeEventListener("mouseup", this.handleResizeEnd);

    this.state.dragState = {
      draggedColumn: null,
      draggedElement: null,
      sourceContainer: undefined,
      resizeStartX: 0,
      resizeColumn: null,
      initialWidth: 0,
      activeColumnSet: [],
      activeContainer: "center",
      resizeGuideElement: null,
    };
  };

  /**
   * 初始化拖拽填充功能
   */
  public initializeDragToFill(): void {
    let isDragging = false;
    let startCell: HTMLElement | null = null;
    let startNode: RowNode | null = null;
    let startColumn: Column | null = null;
    const dragHandleSelector = ".grid-cell-drag-handle";
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.matches(dragHandleSelector)) return;

      const cell = target.closest(".grid-cell") as HTMLElement;
      if (!cell) return;

      const rowId = cell.closest(".grid-row")?.getAttribute("data-row-id");
      const field = cell.dataset.field;
      if (!rowId || !field) return;

      // 使用 convertRowId 方法转换 ID
      const node = this.rowNodes.get(this.convertRowId(rowId));
      const allColumns = [
        ...this.getLeftPinnedColumns(),
        ...this.getCenterColumns(),
        ...this.getRightPinnedColumns(),
      ];
      const column = allColumns.find((c) => c.field === field);

      if (!node || !column) return;

      // 检查列是否允许批量填充
      if (!column.fillable) return;

      e.preventDefault();
      e.stopPropagation();

      isDragging = true;
      startCell = cell;
      startNode = node;
      startColumn = column;

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp, { once: true });
      document.body.style.cursor = "cell";
      document.body.style.userSelect = "none";
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging || !startCell) return;

      const endCell = this.getCellFromPoint(e.clientX, e.clientY);
      if (endCell) {
        this.highlightDragRange(startCell, endCell, startColumn!);
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (!isDragging || !startNode || !startColumn) return;

      const endCell = this.getCellFromPoint(e.clientX, e.clientY);
      if (endCell) {
        const endRow = endCell.closest(".grid-row");
        const endRowId = endRow?.getAttribute("data-row-id");
        if (endRowId) {
          // 使用 convertRowId 方法转换 ID
          const endNode = this.rowNodes.get(this.convertRowId(endRowId));
          if (endNode) {
            this.batchPatchCellValue({
              startNode: startNode,
              endNode: endNode,
              column: startColumn,
              value: startNode.data[startColumn.field],
            });
          }
        }
      }

      isDragging = false;
      startCell = null;
      startNode = null;
      startColumn = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      this.clearDragHighlight();
      document.removeEventListener("mousemove", onMouseMove);
    };

    this.element.addEventListener("mousedown", onMouseDown);
  }

  /**
   * 根据坐标获取单元格元素
   */
  private getCellFromPoint(x: number, y: number): HTMLElement | null {
    const element = document.elementFromPoint(x, y);
    if (!element) return null;
    return element.closest<HTMLElement>(".grid-cell");
  }

  /**
   * 设置单元格值（用于拖拽填充）
   */
  public batchPatchCellValue(params: {
    startNode: RowNode;
    endNode: RowNode;
    column: Column;
    value: any;
  }): void {
    const { startNode, endNode, column, value } = params;

    // 再次检查列是否允许批量填充
    if (!column.fillable) return;

    const minRowIndex = Math.min(startNode.rowIndex, endNode.rowIndex);
    const maxRowIndex = Math.max(startNode.rowIndex, endNode.rowIndex);

    const allNodes = Array.from(this.rowNodes.values());
    const targetNodes = allNodes.filter(
      (node) => node.rowIndex >= minRowIndex && node.rowIndex <= maxRowIndex
    );

    // 直接更新数据，不通过事件总线
    const api = this.getApi();
    
    targetNodes.forEach((node) => {
      if (column.editable !== false) {
        // 保存旧值
        const oldValue = node.data[column.field];
        // 直接更新数据
        node.data[column.field] = value;
        api.refreshCell({ rowNode: node, column });
        // 使用公开的API方法处理值变更
        api.processCellValueChange(node, column.field);
      }
    });
  }

  /**
   * 高亮拖拽范围的单元格（仅限单列）
   */
  public highlightDragRange(
    startCell: HTMLElement,
    endCell: HTMLElement,
    column: Column
  ): void {
    this.clearDragHighlight();
    const allCells = Array.from(
      this.element.querySelectorAll<HTMLElement>(
        `.grid-cell[data-field="${column.field}"]`
      )
    );
    const startIndex = allCells.indexOf(startCell);
    const endIndex = allCells.indexOf(endCell);

    if (startIndex === -1 || endIndex === -1) return;

    const [min, max] = [
      Math.min(startIndex, endIndex),
      Math.max(startIndex, endIndex),
    ];
    for (let i = min; i <= max; i++) {
      allCells[i].classList.add("grid-cell-drag-highlight");
    }
  }

  /**
   * 清除拖拽高亮样式
   */
  public clearDragHighlight(): void {
    this.element
      .querySelectorAll(".grid-cell-drag-highlight")
      .forEach((cell) => {
        cell.classList.remove("grid-cell-drag-highlight");
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
        cell.classList.remove("dragging", "grid-column-drop-target");
      });

      // 同时清理单元格拖拽样式
      this.clearDragHighlight();
    });
  }

  /**
   * 清理和销毁
   */
  public destroy(): void {
    this.element.removeEventListener("dragstart", this.handleDragStart);
    this.element.removeEventListener("dragover", this.handleDragOver);
    this.element.removeEventListener("drop", this.handleDrop);
    this.element.removeEventListener("dragend", this.handleDragEnd);

    // 在这里添加其他需要清理的事件监听器或资源
  }

  private updateDropIndicators = (
    e: DragEvent,
    draggedColumn: Column
  ): void => {
    this.clearDropIndicators();

    const targetCell = (e.target as HTMLElement).closest(".grid-header-cell");
    if (
      !targetCell ||
      (targetCell as HTMLElement).dataset.field === draggedColumn.field
    ) {
      return;
    }

    const rect = targetCell.getBoundingClientRect();
    const isRightHalf = e.clientX > rect.left + rect.width / 2;

    if (isRightHalf) {
      targetCell.classList.add("drop-indicator-right");
    } else {
      targetCell.classList.add("drop-indicator-left");
    }
  };

  private clearDropIndicators(): void {
    this.element
      .querySelectorAll(".drop-indicator-left, .drop-indicator-right")
      .forEach((cell) => {
        cell.classList.remove("drop-indicator-left", "drop-indicator-right");
      });
  }

  /**
   * 转换行ID以匹配原始类型（字符串或数字）
   * 在从 Map 中查找行节点时使用
   */
  private convertRowId(rowId: string | number): string | number {
    if (typeof rowId === "string" && !isNaN(Number(rowId))) {
      // 如果是可以转换为数字的字符串，尝试以数字形式查找
      return Number(rowId);
    }
    return rowId;
  }
}
