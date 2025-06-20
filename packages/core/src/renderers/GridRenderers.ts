import { VirtualDOMManager } from "../managers/VirtualDOMManager";
import { ScrollSyncManager } from "../managers/ScrollSyncManager";
import { ComponentManager } from "../managers/ComponentManager";
import {
  Column,
  GridOptions,
  RowNode,
  ComponentParams,
  GridApi,
} from "../types/index";
import { GridState } from "../interface";
import {
  CheckboxCellRenderer,
  CheckboxHeaderRenderer,
  RowDragRenderer,
  TreeCellRenderer,
  TreeCheckboxCellRenderer
} from "../components";
import { GridEditManager } from "../managers/GridEditManager";

// 扩展GridOptions，添加我们需要的回调函数
interface RendererCallbacks {
  onSortClick?: (e: MouseEvent, col: Column) => void;
  onFilterClick?: (e: MouseEvent, col: Column) => void;
  onResizeStart?: (e: MouseEvent, col: Column, element: HTMLElement) => void;
  onStartEditing?: (
    cell: HTMLElement,
    col: Column,
    row: any,
    value: any
  ) => void;
  onScroll?: (scrollLeft: number, scrollTop: number) => void;
  onRowClick?: (e: MouseEvent, row: any, rowIndex: number) => void;
  onRowDoubleClick?: (e: MouseEvent, row: any, rowIndex: number) => void;
  onCellClick?: (
    e: MouseEvent,
    column: Column,
    row: any,
    value: any,
    rowIndex: number
  ) => void;
  onCellDoubleClick?: (
    e: MouseEvent,
    column: Column,
    row: any,
    value: any,
    rowIndex: number,
    cellElement: HTMLElement
  ) => void;
}

/**
 * GridRenderers - 分离的Grid渲染逻辑
 *
 * 这个类包含与Grid表格渲染相关的方法，被Grid类使用。
 * 通过将渲染逻辑分离到单独的类中，我们使代码更加模块化和可维护。
 */
export class GridRenderers {
  private virtualDOM: VirtualDOMManager;
  private scrollSyncManager: ScrollSyncManager;
  private componentManager: ComponentManager;
  private options: GridOptions & RendererCallbacks;
  private state: GridState;
  private instanceId: string;
  private getApiCallback: () => GridApi;
  private rowNodes: Map<string | number, RowNode>;
  private editManager: GridEditManager;
  private eventBus: any;

  constructor(
    virtualDOM: VirtualDOMManager,
    scrollSyncManager: ScrollSyncManager,
    componentManager: ComponentManager,
    options: GridOptions & RendererCallbacks,
    state: GridState,
    instanceId: string,
    rowNodesMap: Map<string | number, RowNode>,
    getApiCallback: () => GridApi,
    editManager: GridEditManager,
    eventBus?: any
  ) {
    this.virtualDOM = virtualDOM;
    this.scrollSyncManager = scrollSyncManager;
    this.componentManager = componentManager;
    this.options = options;
    this.state = state;
    this.instanceId = instanceId;
    this.rowNodes = rowNodesMap;
    this.getApiCallback = getApiCallback;
    this.editManager = editManager;
    this.eventBus = eventBus || {};
  }

  /**
   * 创建完整的表格 DOM 结构，包括固定的和可滚动的区域
   */
  public renderGridStructure(params: {
    leftPinnedColumns: Column[];
    centerColumns: Column[];
    rightPinnedColumns: Column[];
    getFilteredAndSortedData: () => any[];
    onRowClick?: (e: MouseEvent, row: any, rowIndex: number) => void;
    onRowDoubleClick?: (e: MouseEvent, row: any, rowIndex: number) => void;
    onCellClick?: (
      e: MouseEvent,
      column: Column,
      row: any,
      value: any,
      rowIndex: number
    ) => void;
    onCellDoubleClick?: (
      e: MouseEvent,
      column: Column,
      row: any,
      value: any,
      rowIndex: number,
      cellElement: HTMLElement
    ) => void;
  }): HTMLElement {
    const rootWrapperId = "grid-root-wrapper";
    const rootWrapper = this.virtualDOM.createElement(
      rootWrapperId,
      "div",
      "grid-root-wrapper"
    );
    this.virtualDOM.updateElement(rootWrapperId, {
      styles: {
        display: "flex",
        width: "100%",
      },
    });

    // 检查是否有数据
    const data = params.getFilteredAndSortedData();
    const hasData = data && data.length > 0;

    if (!hasData && this.options.noDataContent) {
      // 无数据时显示noDataContent
      const noDataContainer = this.renderNoDataContent();
      rootWrapper.appendChild(noDataContainer);
      return rootWrapper;
    }

    const bodyElementsToSync: HTMLElement[] = [];
    let centerHeaderEl: HTMLElement | null = null;
    let centerBodyEl: HTMLElement | null = null;

    // 渲染左侧固定区域
    if (params.leftPinnedColumns.length > 0) {
      const leftContainer = this.createPinnedContainer("left");
      const leftHeader = this.renderHeaderContainer(
        params.leftPinnedColumns,
        "left"
      );
      const leftBody = this.renderBodyContainer(
        params.leftPinnedColumns,
        "left",
        params.getFilteredAndSortedData,
        params
      );
      leftContainer.appendChild(leftHeader);
      leftContainer.appendChild(leftBody);
      rootWrapper.appendChild(leftContainer);
      bodyElementsToSync.push(leftBody);
    }

    // 渲染中间滚动区域
    const centerContainer = this.createCenterContainer();
    const centerHeader = this.renderHeaderContainer(
      params.centerColumns,
      "center"
    );
    const centerBody = this.renderBodyContainer(
      params.centerColumns,
      "center",
      params.getFilteredAndSortedData,
      params
    );
    centerContainer.appendChild(centerHeader);
    centerContainer.appendChild(centerBody);
    rootWrapper.appendChild(centerContainer);
    bodyElementsToSync.push(centerBody);

    // 将中间容器的 header 和 body 保存起来用于同步
    centerHeaderEl = centerContainer.querySelector(".grid-header");
    centerBodyEl = centerContainer.querySelector(".grid-body");

    // 渲染右侧固定区域
    if (params.rightPinnedColumns.length > 0) {
      const rightContainer = this.createPinnedContainer("right");
      const rightHeader = this.renderHeaderContainer(
        params.rightPinnedColumns,
        "right"
      );
      const rightBody = this.renderBodyContainer(
        params.rightPinnedColumns,
        "right",
        params.getFilteredAndSortedData,
        params
      );
      rightContainer.appendChild(rightHeader);
      rightContainer.appendChild(rightBody);
      rootWrapper.appendChild(rightContainer);
      bodyElementsToSync.push(rightBody);
    }

    // 使用新的、统一的注册方法
    if (centerBodyEl && centerHeaderEl) {
      this.scrollSyncManager.register({
        bodies: bodyElementsToSync,
        centerHeader: centerHeaderEl,
        centerBody: centerBodyEl,
      });
    }

    return rootWrapper;
  }

  private createPinnedContainer(position: "left" | "right"): HTMLElement {
    const container = document.createElement("div");
    container.className = `grid-pinned-container grid-pinned-${position}`;
    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.flexShrink = "0";
    return container;
  }

  private createCenterContainer(): HTMLElement {
    const container = document.createElement("div");
    container.className = "grid-center-container";
    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.flexGrow = "1";
    container.style.overflow = "hidden";
    return container;
  }

  /**
   * 渲染表格头部
   * @returns HTMLElement 渲染后的头部元素
   */
  private renderHeaderContainer(
    columns: Column[],
    type: "left" | "center" | "right"
  ): HTMLElement {
    const headerWrapperId = `${this.instanceId}-header-wrapper-${type}`;
    this.virtualDOM.createElement(headerWrapperId, "div", "grid-header");
    this.virtualDOM.updateElement(headerWrapperId, {
      styles: {
        display: "flex",
        overflow: "hidden",
      },
    });

    const headerId = `${this.instanceId}-header-${type}`;
    this.virtualDOM.createElement(headerId, "div");
    this.virtualDOM.updateElement(headerId, {
      styles: {
        display: "flex",
        height: `${this.options.headerHeight}px`,
        flex: "1",
        position: "relative",
        minWidth: "fit-content",
      },
    });

    columns.forEach((col) => {
      const cellId = `${this.instanceId}-header-cell-${col.field}`;
      this.virtualDOM.createElement(cellId, "div", "grid-header-cell");

      this.virtualDOM.updateElement(cellId, {
        attributes: {
          "data-field": col.field,
          draggable: col.draggable !== false ? "true" : "false", // 除非明确设置为false，否则允许拖拽
        },
        styles: {
          width: `${col.width}px`,
        },
      });

      // 处理复选框列
      if (col.checkboxSelection) {
        const checkboxContainerId = `${cellId}-checkbox-container`;
        this.virtualDOM.createElement(
          checkboxContainerId,
          "div",
          "grid-header-checkbox-container"
        );

        // 创建复选框头部渲染器
        const headerCheckboxId = `${this.instanceId}-header-checkbox-${col.field}`;
        const headerCheckbox = new CheckboxHeaderRenderer();
        headerCheckbox.init({
          api: this.getApiCallback(),
          column: col,
        });

        const headerCheckboxElement = headerCheckbox.getGui();

        // 将复选框元素添加到容器
        const checkboxContainer =
          this.virtualDOM.getElement(checkboxContainerId);
        if (checkboxContainer) {
          // 清空容器，避免重复添加
          checkboxContainer.innerHTML = "";
          checkboxContainer.appendChild(headerCheckboxElement);
        }

        this.virtualDOM.appendChild(cellId, checkboxContainerId);
        this.virtualDOM.appendChild(headerId, cellId);
        return; // 跳过后续处理
      }

      // 处理行拖拽列
      if (col.rowDrag) {
        const dragContainerId = `${cellId}-drag-container`;
        this.virtualDOM.createElement(
          dragContainerId,
          "div",
          "grid-header-drag-container"
        );

        // 创建拖拽图标
        const dragIconId = `${this.instanceId}-header-drag-icon-${col.field}`;
        this.virtualDOM.createElement(
          dragIconId,
          "div",
          "grid-header-drag-icon"
        );
        // this.virtualDOM.updateElement(dragIconId, {
        //   content: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        //                 <path d="M8 6H10V8H8V6Z" fill="currentColor"/>
        //                 <path d="M14 6H16V8H14V6Z" fill="currentColor"/>
        //                 <path d="M8 10H10V12H8V10Z" fill="currentColor"/>
        //                 <path d="M14 10H16V12H14V10Z" fill="currentColor"/>
        //                 <path d="M8 14H10V16H8V14Z" fill="currentColor"/>
        //                 <path d="M14 14H16V16H14V14Z" fill="currentColor"/>
        //             </svg>`,
        // });

        const dragContainer = this.virtualDOM.getElement(dragContainerId);
        if (dragContainer) {
          const dragIcon = this.virtualDOM.getElement(dragIconId);
          if (dragIcon) {
            dragContainer.appendChild(dragIcon);
          }
        }

        this.virtualDOM.appendChild(cellId, dragContainerId);
        this.virtualDOM.appendChild(headerId, cellId);
        return; // 跳过后续处理
      }

      const titleContainerId = `${this.instanceId}-header-title-container-${col.field}`;
      this.virtualDOM.createElement(
        titleContainerId,
        "div",
        "grid-header-cell-content"
      );

      const titleId = `${this.instanceId}-header-title-${col.field}`;
      this.virtualDOM.createElement(titleId, "div", "grid-header-cell-title");
      this.virtualDOM.updateElement(titleId, {
        content: col.headerName,
      });

      const actionContainerId = `${this.instanceId}-header-actions-${col.field}`;
      this.virtualDOM.createElement(
        actionContainerId,
        "div",
        "grid-header-cell-actions"
      );

      if (col.sortable) {
        const sortButtonId = `${this.instanceId}-sort-button-${col.field}`;
        this.virtualDOM.createElement(
          sortButtonId,
          "button",
          "grid-sort-button"
        );

        const existingSort = this.state.sortModel.find(
          (s) => s.colId === col.field
        );
        if (existingSort) {
          this.virtualDOM.updateElement(sortButtonId, {
            attributes: {
              "data-sort": existingSort.sort,
            },
          });
        }

        this.virtualDOM.updateElement(sortButtonId, {
          content: `<svg class="sort-icon" width="16" height="16" viewBox="0 0 16 16"><path class="sort-up" d="M8 4l4 4H4z"/><path class="sort-down" d="M8 12l4-4H4z"/></svg>`,
          events: {
            click: (e: MouseEvent) => {
              e.stopPropagation();
              // 调用排序点击回调
              if (this.options.onSortClick) {
                this.options.onSortClick(e, col);
              }
            },
          },
        });

        this.virtualDOM.appendChild(actionContainerId, sortButtonId);
      }

      if (col.filterable) {
        const filterButtonId = `${this.instanceId}-filter-button-${col.field}`;
        this.virtualDOM.createElement(
          filterButtonId,
          "button",
          "grid-filter-button"
        );

        const hasFilter = this.state.filterModel.has(col.field);
        if (hasFilter) {
          this.virtualDOM.updateElement(filterButtonId, {
            classes: ["active"],
          });
        }

        this.virtualDOM.updateElement(filterButtonId, {
          content: `<svg class="filter-icon" width="16" height="16" viewBox="0 0 16 16"><path d="M2 2h12l-5 6v6l-2-2V8z"/></svg>`,
          events: {
            click: (e: MouseEvent) => {
              e.stopPropagation();
              if (this.options.onFilterClick) {
                this.options.onFilterClick(e, col);
              }
            },
          },
        });

        this.virtualDOM.appendChild(actionContainerId, filterButtonId);
      }

      this.virtualDOM.appendChild(titleContainerId, titleId);
      this.virtualDOM.appendChild(titleContainerId, actionContainerId);
      this.virtualDOM.appendChild(cellId, titleContainerId);

      if (col.resizable !== false) {
        const resizerId = `${this.instanceId}-resizer-${col.field}`;
        this.virtualDOM.createElement(resizerId, "div", "column-resizer");

        this.virtualDOM.updateElement(resizerId, {
          events: {
            mousedown: (e: MouseEvent) => {
              e.preventDefault();
              e.stopPropagation();
              const cellElement = this.virtualDOM.getElement(cellId);
              if (cellElement && this.options.onResizeStart) {
                this.options.onResizeStart(e, col, cellElement);
              }
            },
          },
        });

        this.virtualDOM.appendChild(cellId, resizerId);
      }

      this.virtualDOM.appendChild(headerId, cellId);
    });

    this.virtualDOM.appendChild(headerWrapperId, headerId);

    return this.virtualDOM.getElement(headerWrapperId)!;
  }

  private renderBodyContainer(
    columns: Column[],
    type: "left" | "center" | "right",
    getFilteredAndSortedData: () => any[],
    eventHandlers?: {
      onRowClick?: (e: MouseEvent, row: any, rowIndex: number) => void;
      onRowDoubleClick?: (e: MouseEvent, row: any, rowIndex: number) => void;
      onCellClick?: (
        e: MouseEvent,
        column: Column,
        row: any,
        value: any,
        rowIndex: number
      ) => void;
      onCellDoubleClick?: (
        e: MouseEvent,
        column: Column,
        row: any,
        value: any,
        rowIndex: number,
        cellElement: HTMLElement
      ) => void;
    }
  ): HTMLElement {
    const data = getFilteredAndSortedData();
    const bodyWrapperId = `${this.instanceId}-body-wrapper-${type}`;
    this.virtualDOM.createElement(bodyWrapperId, "div", "grid-body");

    // 设置body容器的样式
    const viewportStyles: { [key: string]: string } = {
      position: "relative",
      flex: "1 1 auto",
    };

    // 设置水平滚动行为
    if (type === "center") {
      viewportStyles.overflowX = "auto";
    } else {
      viewportStyles.overflowX = "hidden";
    }

    // 设置垂直滚动行为
    // 始终允许垂直滚动，高度限制将由容器设置控制
    viewportStyles.overflowY = "auto";

    // 应用最小高度（在grid-body上而非外层grid-container）
    if (this.options.minHeight !== undefined) {
      const minHeight =
        typeof this.options.minHeight === "number"
          ? `${this.options.minHeight}px`
          : this.options.minHeight;
      viewportStyles.minHeight = minHeight;
    }

    // 应用最大高度（在grid-body上而非外层grid-container）
    if (this.options.maxHeight !== undefined) {
      const maxHeight =
        typeof this.options.maxHeight === "number"
          ? `${this.options.maxHeight}px`
          : this.options.maxHeight;
      viewportStyles.maxHeight = maxHeight;
    }

    this.virtualDOM.updateElement(bodyWrapperId, { styles: viewportStyles });

    const bodyId = `${this.instanceId}-body-${type}`;
    this.virtualDOM.createElement(bodyId, "div");

    // 计算并设置内部容器的总宽度和高度
    const totalWidth = columns.reduce((acc, col) => acc + (col.width || 0), 0);
    const totalHeight = data.length * this.options.rowHeight!;

    this.virtualDOM.updateElement(bodyId, {
      styles: {
        height: `${totalHeight}px`,
        position: "relative",
        width: `${totalWidth}px`,
      },
    });

    this.virtualDOM.appendChild(bodyWrapperId, bodyId);

    const bodyWrapperElement = this.virtualDOM.getElement(bodyWrapperId);
    if (bodyWrapperElement) {
      bodyWrapperElement.addEventListener("scroll", (e: Event) => {
        const target = e.target as HTMLElement;
        if (this.options.onScroll) {
          this.options.onScroll(target.scrollLeft, target.scrollTop);
        }
        // 滚动时直接重新渲染可见行
        this.renderVisibleRows(
          bodyId,
          columns,
          getFilteredAndSortedData,
          eventHandlers
        );
      });
    }

    // 初始渲染
    this.renderVisibleRows(
      bodyId,
      columns,
      getFilteredAndSortedData,
      eventHandlers
    );

    return this.virtualDOM.getElement(bodyWrapperId)!;
  }

  /**
   * 渲染可见行
   */
  renderVisibleRows(
    containerId: string,
    columns: Column[],
    getFilteredAndSortedData: () => any[],
    eventHandlers?: {
      onRowClick?: (e: MouseEvent, row: any, rowIndex: number) => void;
      onRowDoubleClick?: (e: MouseEvent, row: any, rowIndex: number) => void;
      onCellClick?: (
        e: MouseEvent,
        column: Column,
        row: any,
        value: any,
        rowIndex: number
      ) => void;
      onCellDoubleClick?: (
        e: MouseEvent,
        column: Column,
        row: any,
        value: any,
        rowIndex: number,
        cellElement: HTMLElement
      ) => void;
    }
  ): void {
    const container = this.virtualDOM.getElement(containerId);
    if (!container) return;

    // 关键修复：在重新渲染前，清空容器以移除所有旧的行
    container.innerHTML = "";

    // 获取经过过滤和排序后的数据
    const data = getFilteredAndSortedData();
    const scrollTop = this.state.scrollPosition.top;
    const containerHeight =
      this.virtualDOM.getElement(containerId)?.parentElement?.clientHeight ||
      500;
    const rowHeight = this.options.rowHeight || 40;

    // 修改：获取可见区域更大的范围，确保能够渲染所有行
    const bufferScreens = 2; // 额外缓冲屏幕数量
    const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - 10);
    const endIndex = Math.min(
      data.length,
      Math.ceil(
        (scrollTop + containerHeight * (1 + bufferScreens)) / rowHeight
      ) + 10
    );

    // 获取当前可见范围的数据行
    const visibleRows = data.slice(startIndex, endIndex);
    this.state.virtualBodyRowIds.clear();

    // 修复：重新计算实际行位置，确保树形结构下的子节点位置正确
    visibleRows.forEach((row, index) => {
      const rowIndex = startIndex + index;
      // 使用包含父级信息的唯一ID格式，确保树形结构下子节点被正确定位
      const rowId = `${this.instanceId}-row-${row.id}-${containerId}`;
      this.state.virtualBodyRowIds.add(rowId);

      // 删除已存在的行元素，避免ID冲突
      const existingRow = this.virtualDOM.getElement(rowId);
      if (existingRow) {
        existingRow.remove();
      }

      // 创建新行元素
      this.virtualDOM.createElement(rowId, "div", "grid-row");
      
      // 获取行节点，用于访问层级信息
      const rowNode = this.rowNodes.get(row.id);
      
      this.virtualDOM.updateElement(rowId, {
        attributes: {
          "data-row-index": rowIndex.toString(),
          "data-row-id": row.id.toString(),
          // 添加层级属性，可用于调试和样式
          "data-level": rowNode && rowNode.level !== undefined ? rowNode.level.toString() : "0",
        },
        styles: {
          top: `${rowIndex * rowHeight}px`,
          height: `${rowHeight}px`,
        },
        events: {
          click: (e: MouseEvent) => {
            if (eventHandlers?.onRowClick) {
              eventHandlers.onRowClick(e, row, rowIndex);
            }
          },
          dblclick: (e: MouseEvent) => {
            if (eventHandlers?.onRowDoubleClick) {
              eventHandlers.onRowDoubleClick(e, row, rowIndex);
            }
          },
        },
      });

      columns.forEach((col) => {
        // 使用全局唯一的ID格式
        const cellId = `${this.instanceId}_cell_${row.id}_${col.field}`;

        // 确保删除旧的单元格元素
        const existingCell = this.virtualDOM.getElement(cellId);
        if (existingCell) {
          existingCell.remove();
        }

        this.virtualDOM.createElement(cellId, "div", "grid-cell");

        // 将列宽和 data-field 应用到单元格
        this.virtualDOM.updateElement(cellId, {
          attributes: {
            "data-field": col.field,
          },
          styles: {
            width: `${col.width}px`,
          },
        });

        const cellElement = this.virtualDOM.getElement(cellId);
        if (cellElement) {
          const value = row[col.field];
          this.renderCell(cellElement, col, row, value, rowIndex);
          this.virtualDOM.updateElement(cellId, {
            events: {
              click: (e: MouseEvent) => {
                e.stopPropagation();
                if (eventHandlers?.onCellClick) {
                  eventHandlers.onCellClick(e, col, row, value, rowIndex);
                }
              },
              dblclick: (e: MouseEvent) => {
                e.stopPropagation();
                if (eventHandlers?.onCellDoubleClick) {
                  eventHandlers.onCellDoubleClick(
                    e,
                    col,
                    row,
                    value,
                    rowIndex,
                    cellElement
                  );
                }
              },
            },
          });
        }
        this.virtualDOM.appendChild(rowId, cellId);
      });

      this.virtualDOM.appendChild(containerId, rowId);
    });

    // 确保容器总高度正确，这样滚动条才能正确显示
    const totalHeight = data.length * rowHeight;
    container.style.height = `${totalHeight}px`;

    // 添加容器总宽度设置，防止水平方向出现类似问题
    const totalWidth = columns.reduce((acc, col) => acc + (col.width || 0), 0);
    container.style.width = `${totalWidth}px`;
  }

  /**
   * 渲染单个单元格
   */
  renderCell(
    cell: HTMLElement,
    column: Column,
    row: any,
    value: any,
    rowIndex: number
  ): void {
    const cellId = cell.getAttribute("data-element-id");
    if (!cellId) return;

    // 强制清空单元格的真实DOM，确保从一个干净的状态开始
    cell.innerHTML = "";

    // 处理特殊渲染器，如复选框
    if (this.handleSpecialRenderers(cell, column, row, value, rowIndex)) {
      return;
    }

    // 新增：处理树形列
    if (column.treeColumn) {
      this.handleTreeRenderer(cell, column, row, value, rowIndex);
      return;
    }

    const node = this.rowNodes.get(row.id || rowIndex);
    if (!node) return;

    const isEditing =
      this.state.editingCell?.rowId === node.id &&
      this.state.editingCell?.field === column.field;

    // 添加或移除editing类
    if (isEditing) {
      cell.classList.add("editing");
    } else {
      cell.classList.remove("editing");
    }

    // 创建唯一的顶级内容容器
    const contentId = `${cellId}-content`;
    this.virtualDOM.createElement(contentId, "div", "grid-cell-content");
    const contentContainer = this.virtualDOM.getElement(contentId);

    if (!contentContainer) return;

    // 渲染前总是清空内容容器
    contentContainer.innerHTML = "";

    if (isEditing && column.editable) {
      // --- 开始渲染编辑器 ---
      const params: ComponentParams = {
        value,
        startValue: value,
        data: node.data,
        rowIndex: node.rowIndex,
        colId: column.field,
        column,
        colDef: column,
        eventBus: this.eventBus,
        api: this.getApiCallback(),
        node,
        onComplete: (newValue: any) =>
          this.editManager.stopEditing(true, newValue),
        onCancel: () => this.editManager.stopEditing(false),
        stopEditing: (save: boolean, newValue?: any) =>
          this.editManager.stopEditing(save, newValue),
      };

      const editComponentId = `${cellId}-edit-comp`;
      const editElement = this.componentManager.createEditComponent(
        editComponentId,
        column,
        params
      );
      contentContainer.appendChild(editElement);

      // 自动聚焦和事件处理
      setTimeout(() => {
        const input = contentContainer.querySelector<
          HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
        >("input, select, textarea");
        if (input) {
          input.focus();
          if (input.tagName === "INPUT") (input as HTMLInputElement).select();

          let isHandled = false;
          const stopEditingOnce = (save: boolean) => {
            if (!isHandled) {
              isHandled = true;
              const finalValue =
                input.tagName === "INPUT" ||
                input.tagName === "SELECT" ||
                input.tagName === "TEXTAREA"
                  ? input.value
                  : value;
              this.editManager.stopEditing(save, finalValue);
            }
          };

          input.addEventListener("blur", () => stopEditingOnce(true));
          input.addEventListener("keydown", (e) => {
            const keyboardEvent = e as KeyboardEvent;
            if (keyboardEvent.key === "Enter") {
              keyboardEvent.preventDefault();
              stopEditingOnce(true);
            } else if (keyboardEvent.key === "Escape") {
              keyboardEvent.preventDefault();
              stopEditingOnce(false);
            }
          });
        }
      }, 0);
      // --- 结束渲染编辑器 ---
    } else {
      // --- 开始渲染视图 ---
      const params: ComponentParams = {
        value,
        data: node.data,
        rowIndex: node.rowIndex,
        colId: column.field,
        column,
        api: this.getApiCallback(),
        node,
      };

      const viewComponentId = `${cellId}-view-comp`;
      const viewElement = this.componentManager.createViewComponent(
        viewComponentId,
        column,
        params
      );
      contentContainer.appendChild(viewElement);
      // --- 结束渲染视图 ---
    }

    // 为普通单元格添加拖拽填充句柄
    if (
      !isEditing &&
      !column.checkboxSelection &&
      !column.rowDrag &&
      column.fillable === true
    ) {
      const dragHandleId = `${contentId}-draghandle`;
      this.virtualDOM.createElement(
        dragHandleId,
        "div",
        "grid-cell-drag-handle"
      );
      this.virtualDOM.updateElement(dragHandleId, {
        styles: {
          position: "absolute",
          right: "0px",
          bottom: "0px",
          width: "8px",
          height: "8px",
          cursor: "cell",
          zIndex: "10",
        },
      });
      this.virtualDOM.appendChild(contentId, dragHandleId);
    }

    // 将内容容器附加到单元格的虚拟DOM表示中
    this.virtualDOM.appendChild(cellId, contentId);
  }

  /**
   * 处理树形单元格渲染器
   */
  private handleTreeRenderer(
    cell: HTMLElement,
    column: Column,
    row: any,
    value: any,
    rowIndex: number
  ): void {
    const cellId = cell.getAttribute("data-element-id")!;
    const node = this.rowNodes.get(row.id || rowIndex);

    if (!node) return;

    const treeRenderer = new TreeCellRenderer();
    treeRenderer.init({
      value,
      data: row,
      rowIndex,
      colId: column.field,
      column,
      colDef: column,
      api: this.getApiCallback(),
      node,
      eventBus: this.eventBus,
    });

    const treeElement = treeRenderer.getGui();
    const containerId = `${cellId}-tree-container`;
    this.virtualDOM.createElement(
      containerId,
      "div",
      "grid-tree-cell-container"
    );
    const container = this.virtualDOM.getElement(containerId);

    if (container) {
      container.innerHTML = "";
      container.appendChild(treeElement);
    }

    this.virtualDOM.appendChild(cellId, containerId);
  }

  /**
   * 处理特殊的单元格渲染器，如复选框和行拖拽
   * @returns {boolean} 如果处理了特殊渲染器则返回true
   */
  private handleSpecialRenderers(
    cell: HTMLElement,
    column: Column,
    row: any,
    value: any,
    rowIndex: number
  ): boolean {
    const cellId = cell.getAttribute("data-element-id")!;

    if (column.checkboxSelection) {
      const checkboxContainerId = `${cellId}-checkbox-container`;
      this.virtualDOM.createElement(
        checkboxContainerId,
        "div",
        "grid-cell-checkbox-container"
      );
      this.virtualDOM.updateElement(checkboxContainerId, {
        styles: {
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          width: "100%",
        },
      });

      const node = this.rowNodes.get(row.id || rowIndex);
      if (!node) return true;

      // 检查是否是树形表格模式
      if (this.options.treeData) {
        // 在树形表格模式下使用TreeCheckboxCellRenderer
        const treeCheckboxRenderer = new TreeCheckboxCellRenderer();
        treeCheckboxRenderer.init({
          value: node.selected,
          data: row,
          rowIndex,
          colId: column.field,
          column,
          colDef: column,
          api: this.getApiCallback(),
          node,
          eventBus: this.eventBus
        });

        const checkboxElement = treeCheckboxRenderer.getGui();
        const checkboxContainer = this.virtualDOM.getElement(checkboxContainerId);
        if (checkboxContainer) {
          checkboxContainer.innerHTML = "";
          checkboxContainer.appendChild(checkboxElement);
        }
      } else {
        // 在普通表格模式下使用标准CheckboxCellRenderer
        const checkboxRenderer = new CheckboxCellRenderer();
        checkboxRenderer.init({
          value: node.selected,
          data: row,
          rowIndex,
          colId: column.field,
          column,
          colDef: column,
          api: this.getApiCallback(),
          node,
          eventBus: this.eventBus
        });

        const checkboxElement = checkboxRenderer.getGui();
        const checkboxContainer = this.virtualDOM.getElement(checkboxContainerId);
        if (checkboxContainer) {
          checkboxContainer.innerHTML = "";
          checkboxContainer.appendChild(checkboxElement);
        }
      }

      this.virtualDOM.appendChild(cellId, checkboxContainerId);
      return true;
    }

    if (column.rowDrag) {
      const dragContainerId = `${cellId}-drag-container`;
      this.virtualDOM.createElement(
        dragContainerId,
        "div",
        "grid-cell-drag-container"
      );
      this.virtualDOM.updateElement(dragContainerId, {
        styles: {
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          width: "100%",
        },
      });

      const node = this.rowNodes.get(row.id || rowIndex);
      if (!node) return true;

      const dragRenderer = new RowDragRenderer();
      dragRenderer.init({
        value: null,
        data: row,
        rowIndex,
        colId: column.field,
        column,
        colDef: column,
        api: this.getApiCallback(),
        node,
        eventBus: this.eventBus
      });

      const dragElement = dragRenderer.getGui();
      const dragContainer = this.virtualDOM.getElement(dragContainerId);
      if (dragContainer) {
        dragContainer.innerHTML = "";
        dragContainer.appendChild(dragElement);
      }

      this.virtualDOM.appendChild(cellId, dragContainerId);
      return true;
    }

    return false;
  }

  /**
   * 渲染无数据内容
   */
  private renderNoDataContent(): HTMLElement {
    const noDataContainer = document.createElement("div");
    noDataContainer.className = "grid-no-data-container";

    // 设置样式使其居中显示
    Object.assign(noDataContainer.style, {
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      width: "100%",
      height: "100%",
      padding: "20px",
      boxSizing: "border-box",
      color: "#666",
      fontSize: "14px",
    });

    // 应用与grid-body相同的高度限制
    if (this.options.minHeight !== undefined) {
      const minHeight =
        typeof this.options.minHeight === "number"
          ? `${this.options.minHeight}px`
          : this.options.minHeight;
      noDataContainer.style.minHeight = minHeight;
    }

    if (this.options.maxHeight !== undefined) {
      const maxHeight =
        typeof this.options.maxHeight === "number"
          ? `${this.options.maxHeight}px`
          : this.options.maxHeight;
      noDataContainer.style.maxHeight = maxHeight;
    }

    // 添加内容
    if (typeof this.options.noDataContent === "string") {
      noDataContainer.textContent = this.options.noDataContent;
    } else if (this.options.noDataContent instanceof HTMLElement) {
      noDataContainer.appendChild(this.options.noDataContent);
    } else {
      noDataContainer.textContent = "暂无数据";
    }

    return noDataContainer;
  }
}
