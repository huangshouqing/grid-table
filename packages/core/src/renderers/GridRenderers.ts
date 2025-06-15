import { VirtualDOMManager } from "../managers/VirtualDOMManager";
import { ScrollSyncManager } from "../managers/ScrollSyncManager";
import { ComponentManager } from "../managers/ComponentManager";
import { 
  Column, 
  GridOptions, 
  RowNode, 
  ComponentParams, 
  GridApi
} from "../types/index";
import { GridState } from "../interface";
import { 
  CheckboxCellRenderer, 
  CheckboxHeaderRenderer 
} from "./CheckboxCellRenderer";
import { RowDragRenderer } from "./RowDragRenderer";
import { TreeCellRenderer } from "./TreeCellRenderer";

// 扩展GridOptions，添加我们需要的回调函数
interface RendererCallbacks {
  onSortClick?: (e: MouseEvent, col: Column) => void;
  onFilterClick?: (e: MouseEvent, col: Column) => void;
  onResizeStart?: (e: MouseEvent, col: Column, element: HTMLElement) => void;
  onStartEditing?: (cell: HTMLElement, col: Column, row: any, value: any) => void;
  onScroll?: (scrollLeft: number, scrollTop: number) => void;
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

  constructor(
    virtualDOM: VirtualDOMManager,
    scrollSyncManager: ScrollSyncManager,
    componentManager: ComponentManager,
    options: GridOptions & RendererCallbacks,
    state: GridState,
    instanceId: string,
    rowNodesMap: Map<string | number, RowNode>,
    getApiCallback: () => GridApi
  ) {
    this.virtualDOM = virtualDOM;
    this.scrollSyncManager = scrollSyncManager;
    this.componentManager = componentManager;
    this.options = options;
    this.state = state;
    this.instanceId = instanceId;
    this.rowNodes = rowNodesMap;
    this.getApiCallback = getApiCallback;
  }

  /**
   * 渲染表格头部
   * @returns HTMLElement 渲染后的头部元素
   */
  renderHeader(): HTMLElement | null {
    const headerWrapperId = `${this.instanceId}-header-wrapper`;
    this.virtualDOM.createElement(headerWrapperId, "div", "grid-header");
    this.virtualDOM.updateElement(headerWrapperId, {
      styles: {
        display: "flex",
        overflow: "hidden",
      },
    });

    const headerId = `${this.instanceId}-header`;
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

    this.options.columns.forEach((col) => {
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
        this.virtualDOM.updateElement(dragIconId, {
          content: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M8 6H10V8H8V6Z" fill="currentColor"/>
                        <path d="M14 6H16V8H14V6Z" fill="currentColor"/>
                        <path d="M8 10H10V12H8V10Z" fill="currentColor"/>
                        <path d="M14 10H16V12H14V10Z" fill="currentColor"/>
                        <path d="M8 14H10V16H8V14Z" fill="currentColor"/>
                        <path d="M14 14H16V16H14V14Z" fill="currentColor"/>
                    </svg>`,
        });

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

    const headerWrapperElement = this.virtualDOM.getElement(headerWrapperId);
    if (headerWrapperElement) {
      this.scrollSyncManager.addScrollable("header", headerWrapperElement, {
        syncHorizontal: true,
        syncVertical: false,
      });
    }

    return headerWrapperElement;
  }

  /**
   * 渲染表格主体内容
   * @param getFilteredAndSortedData 获取过滤和排序后的数据函数
   * @returns HTMLElement 渲染后的主体元素
   */
  renderBody(getFilteredAndSortedData: () => any[]): HTMLElement | null {
    const bodyId = `${this.instanceId}-body`;
    this.virtualDOM.createElement(bodyId, "div", "grid-body");
    this.virtualDOM.updateElement(bodyId, {
      styles: {
        overflowX: "auto",
        overflowY: "auto",
      },
      attributes: {
        style: "overflow-x: auto; overflow-y: auto;",
      },
    });

    const contentId = `${this.instanceId}-content`;
    this.virtualDOM.createElement(contentId, "div", "grid-content");
    this.virtualDOM.updateElement(contentId, {
      styles: {
        minWidth: "fit-content",
      },
    });

    const displayedData = getFilteredAndSortedData();
    const currentVRowIds = new Set<string>();

    // 保存行合并信息，用于标记被合并的单元格
    const mergedCells: Map<
      string,
      { mergeType: "row" | "col"; parentCell: string }
    > = new Map();

    displayedData.forEach((row, rowIndex) => {
      const rowId = row.id?.toString() || rowIndex.toString();
      const vRowId = `${this.instanceId}-row-${rowId}`;
      currentVRowIds.add(vRowId);

      this.virtualDOM.createElement(vRowId, "div", "grid-row");
      const rowHeight = this.options.rowHeight || 40;
      this.virtualDOM.updateElement(vRowId, {
        attributes: { "data-row-id": rowId },
        styles: {
          height: `${rowHeight}px`,
          position: "relative",
          display: "flex",
        },
        events: {
          click: (e: MouseEvent) => {
            if (this.options.onRowClicked) {
              const node = this.rowNodes.get(rowId);
              if (node) {
                this.options.onRowClicked({
                  node,
                  data: row,
                  event: e
                });
              }
            }
          },
          dblclick: (e: MouseEvent) => {
            if (this.options.onRowDoubleClicked) {
              const node = this.rowNodes.get(rowId);
              if (node) {
                this.options.onRowDoubleClicked({
                  node,
                  data: row,
                  event: e
                });
              }
            }
          },
        },
      });

      // 获取当前行的节点
      const node = this.rowNodes.get(rowId);

      this.options.columns.forEach((col, colIndex) => {
        // 生成单元格ID
        const vCellId = `${this.instanceId}-cell-${rowId}-${col.field}`;
        const cellKey = `${rowIndex}-${colIndex}`;

        // 检查这个单元格是否是被合并的单元格
        if (mergedCells.has(cellKey)) {
          // 创建一个占位单元格，但设为隐藏
          const cellClasses = ["grid-cell", "grid-cell-hidden"];
          this.virtualDOM.createElement(vCellId, "div", cellClasses.join(" "));
          this.virtualDOM.updateElement(vCellId, {
            attributes: {
              "data-field": col.field,
              "data-element-id": vCellId,
              "data-merged": "true",
              "data-parent-cell": mergedCells.get(cellKey)?.parentCell || "",
            },
            styles: {
              width: `${col.width}px`,
              height: `${rowHeight}px`,
            },
          });

          this.virtualDOM.appendChild(vRowId, vCellId);
          return;
        }

        // 正常创建单元格
        const cellClasses = ["grid-cell"];
        if (col.editable) {
          cellClasses.push("editable");
        }

        // 为树形单元格添加特殊类
        if (
          node &&
          node.level !== undefined &&
          node.level > 0 &&
          col === this.options.columns[0]
        ) {
          cellClasses.push("grid-tree-cell");
        }

        this.virtualDOM.createElement(vCellId, "div", cellClasses.join(" "));

        const value = row[col.field];

        // 处理列合并
        let colSpan = 1;
        if (col.colSpan && node) {
          const params = {
            value,
            data: row,
            node,
            colDef: col,
            rowIndex,
            api: this.getApiCallback(),
            column: col,
            colId: col.field,
            refreshCell: () => {},
          };
          colSpan = col.colSpan(params) || 1;

          // 如果需要合并列
          if (colSpan > 1) {
            // 标记合并单元格
            cellClasses.push("grid-cell-merged");

            // 标记被合并的单元格
            for (let i = 1; i < colSpan; i++) {
              if (colIndex + i < this.options.columns.length) {
                const mergedCellKey = `${rowIndex}-${colIndex + i}`;
                mergedCells.set(mergedCellKey, {
                  mergeType: "col",
                  parentCell: vCellId,
                });
              }
            }
          }
        }

        // 处理行合并
        let rowSpan = 1;
        if (this.options.rowSpan && node) {
          const params = {
            data: row,
            node,
            rowIndex,
            field: col.field,
            colId: col.field,
            api: this.getApiCallback(),
          };
          rowSpan = this.options.rowSpan(params) || 1;

          // 如果需要合并行
          if (rowSpan > 1) {
            // 标记合并单元格
            cellClasses.push("grid-cell-merged");

            // 标记被合并的单元格
            for (let i = 1; i < rowSpan; i++) {
              if (rowIndex + i < displayedData.length) {
                const mergedCellKey = `${rowIndex + i}-${colIndex}`;
                mergedCells.set(mergedCellKey, {
                  mergeType: "row",
                  parentCell: vCellId,
                });
              }
            }
          }
        }

        // 计算单元格样式
        const cellStyles: Record<string, string> = {
          width: `${col.width}px`,
          height: `${rowHeight}px`,
        };

        // 如果是合并单元格，调整尺寸
        if (colSpan > 1) {
          let totalWidth = col.width;
          for (let i = 1; i < colSpan; i++) {
            if (colIndex + i < this.options.columns.length) {
              totalWidth += this.options.columns[colIndex + i].width;
            }
          }
          cellStyles.width = `${totalWidth}px`;
        }

        if (rowSpan > 1) {
          cellStyles.height = `${rowSpan * rowHeight}px`;
          cellStyles.position = "absolute";
          cellStyles.zIndex = "5";
        }

        this.virtualDOM.updateElement(vCellId, {
          attributes: {
            "data-field": col.field,
            "data-element-id": vCellId,
            colspan: colSpan > 1 ? colSpan.toString() : "1",
            rowspan: rowSpan > 1 ? rowSpan.toString() : "1",
          },
          styles: cellStyles,
          classes: cellClasses,
          events: {
            click: (e: MouseEvent) => {
              if (this.options.onCellClicked && node) {
                this.options.onCellClicked({
                  node,
                  data: row,
                  column: col,
                  colId: col.field,
                  value,
                  event: e
                });
              }
              if (col.editable && this.options.onStartEditing) {
                this.options.onStartEditing(
                  e.currentTarget as HTMLElement,
                  col,
                  row,
                  value
                );
              }
            },
            dblclick: (e: MouseEvent) => {
              if (this.options.onCellDoubleClicked && node) {
                this.options.onCellDoubleClicked({
                  node,
                  data: row,
                  column: col,
                  colId: col.field,
                  value,
                  event: e
                });
              }
              if (col.editable && this.options.onStartEditing) {
                this.options.onStartEditing(
                  e.currentTarget as HTMLElement,
                  col,
                  row,
                  value
                );
              }
            },
          },
        });

        // 渲染单元格
        const cellElement = this.virtualDOM.getElement(vCellId) as HTMLElement;

        // 对于第一列且是树形结构的行，使用树形渲染器
        if (
          node &&
          node.level !== undefined &&
          col === this.options.columns[0] &&
          !col.checkboxSelection &&
          !col.rowDrag
        ) {
          // 清空单元格内容，避免重复添加树形结构
          cellElement.innerHTML = "";

          // 创建树形单元格渲染器
          const treeCellRenderer = new TreeCellRenderer();
          treeCellRenderer.init({
            value,
            data: row,
            rowIndex,
            colId: col.field,
            column: col,
            api: this.getApiCallback(),
            node,
          });

          const treeElement = treeCellRenderer.getGui();
          cellElement.appendChild(treeElement);
        } else {
          // 使用标准渲染
          this.renderCell(cellElement, col, row, value, rowIndex);
        }

        this.virtualDOM.appendChild(vRowId, vCellId);
      });
      this.virtualDOM.appendChild(contentId, vRowId);
    });

    const oldVRowIds = this.state.virtualBodyRowIds;
    for (const oldId of oldVRowIds) {
      if (!currentVRowIds.has(oldId)) {
        this.virtualDOM.removeElement(oldId);
      }
    }
    this.state.virtualBodyRowIds = currentVRowIds;

    this.virtualDOM.appendChild(bodyId, contentId);

    const bodyElement = this.virtualDOM.getElement(bodyId);
    if (bodyElement) {
      // 将body元素注册为主滚动元素
      this.scrollSyncManager.addScrollable("body", bodyElement, {
        syncHorizontal: true,
        syncVertical: true,
        master: true,
      });

      // 为表头单独添加事件监听
      const headerElement = document.querySelector(
        `.grid-header[id^="${this.instanceId}"]`
      ) as HTMLElement;
      if (headerElement) {
        this.scrollSyncManager.addScrollable("header", headerElement, {
          syncHorizontal: true,
          syncVertical: false,
          master: false,
        });
      }

      // 保存当前的水平滚动位置，确保垂直滚动时不会丢失
      let savedScrollLeft = 0;

      // 添加滚动事件监听器
      bodyElement.addEventListener(
        "scroll",
        () => {
          // 只有当水平滚动位置变化时，才更新savedScrollLeft
          if (bodyElement.scrollLeft !== savedScrollLeft) {
            savedScrollLeft = bodyElement.scrollLeft;
          }

          // 确保表头同步水平滚动位置
          if (headerElement) {
            headerElement.scrollLeft = savedScrollLeft;
          }
          
          // 触发滚动回调
          if (this.options.onScroll) {
            this.options.onScroll(bodyElement.scrollLeft, bodyElement.scrollTop);
          }
        },
        { passive: true }
      );
    }
    return bodyElement;
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

    // 处理复选框列
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

      // 获取节点
      const node = this.rowNodes.get(row.id || rowIndex);
      if (!node) return;

      // 创建复选框渲染器
      const checkboxId = `${cellId}-checkbox`;
      const checkboxRenderer = new CheckboxCellRenderer();
      checkboxRenderer.init({
        value: node.selected,
        data: row,
        rowIndex,
        colId: column.field,
        column,
        api: this.getApiCallback(),
        node,
      });

      const checkboxElement = checkboxRenderer.getGui();

      // 将复选框元素添加到容器
      const checkboxContainer = this.virtualDOM.getElement(checkboxContainerId);
      if (checkboxContainer) {
        checkboxContainer.innerHTML = "";
        checkboxContainer.appendChild(checkboxElement);
      }

      this.virtualDOM.appendChild(cellId, checkboxContainerId);
      return;
    }

    // 处理行拖拽列
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

      // 获取节点
      const node = this.rowNodes.get(row.id || rowIndex);
      if (!node) return;

      // 创建拖拽渲染器
      const dragId = `${cellId}-drag`;
      const dragRenderer = new RowDragRenderer();
      dragRenderer.init({
        value: null,
        data: row,
        rowIndex,
        colId: column.field,
        column,
        api: this.getApiCallback(),
        node,
      });

      const dragElement = dragRenderer.getGui();

      // 将拖拽元素添加到容器
      const dragContainer = this.virtualDOM.getElement(dragContainerId);
      if (dragContainer) {
        dragContainer.innerHTML = "";
        dragContainer.appendChild(dragElement);
      }

      this.virtualDOM.appendChild(cellId, dragContainerId);
      return;
    }

    // 获取内容容器ID
    const contentId = `${cellId}-content`;

    // 检查内容容器是否存在，如果不存在则创建
    let contentElement = this.virtualDOM.getElement(contentId);
    if (!contentElement) {
      // 创建单元格内容容器
      this.virtualDOM.createElement(contentId, "div", "grid-cell-content");
      this.virtualDOM.updateElement(contentId, {
        styles: {
          position: "relative",
          width: "100%",
          height: "100%",
          boxSizing: "border-box",
          overflow: "hidden",
        },
      });

      // 添加拖拽手柄
      const dragHandleId = `${contentId}-draghandle`;
      this.virtualDOM.createElement(
        dragHandleId,
        "div",
        "grid-cell-drag-handle"
      );
      this.virtualDOM.updateElement(dragHandleId, {
        styles: {
          position: "absolute",
          right: "0",
          bottom: "0",
          width: "6px",
          height: "6px",
          zIndex: "2",
        },
      });
      this.virtualDOM.appendChild(contentId, dragHandleId);

      // 获取创建后的元素
      contentElement = this.virtualDOM.getElement(contentId);
    }

    // 创建视图容器ID
    const viewContainerId = `${contentId}-view`;

    // 如果单元格处于编辑状态，隐藏视图组件但不销毁它
    if (cell.classList.contains("editing")) {
      const viewContainer = this.virtualDOM.getElement(viewContainerId);
      if (viewContainer) {
        viewContainer.style.display = "none";
      }
      return;
    }

    // 创建渲染参数
    const node = this.rowNodes.get(row.id || rowIndex);
    if (!node) return;

    const params: ComponentParams = {
      value,
      data: row,
      rowIndex,
      colId: column.field,
      column,
      api: this.getApiCallback(),
      node,
    };

    // 创建视图组件
    const viewComponentId = `${cellId}-view`;
    const viewElement = this.componentManager.createViewComponent(
      viewComponentId,
      column,
      params
    );

    // 创建或获取视图容器
    let viewContainer = this.virtualDOM.getElement(viewContainerId);
    if (!viewContainer) {
      // 如果视图容器不存在，创建它
      this.virtualDOM.createElement(
        viewContainerId,
        "div",
        "grid-cell-view-container"
      );
      this.virtualDOM.appendChild(contentId, viewContainerId);
      viewContainer = this.virtualDOM.getElement(viewContainerId);
    }

    // 更新视图容器内容
    if (viewContainer) {
      // 确保视图容器可见
      viewContainer.style.display = "flex";

      // 清空并添加视图元素
      viewContainer.innerHTML = "";
      viewContainer.appendChild(viewElement);

      // 如果列是可编辑的但没有自定义编辑器，添加点击事件来启动默认编辑
      if (
        column.editable &&
        !(
          column.cellRenderer &&
          typeof column.cellRenderer === "object" &&
          "edit" in column.cellRenderer
        ) &&
        this.options.onStartEditing
      ) {
        viewContainer.style.cursor = "pointer";
        viewContainer.onclick = (e: MouseEvent) => {
          this.options.onStartEditing!(cell, column, row, value);
        };
      }
    }

    // 确保编辑容器隐藏
    const editContainerId = `${contentId}-edit`;
    const editContainer = this.virtualDOM.getElement(editContainerId);
    if (editContainer) {
      editContainer.style.display = "none";
    }

    // 附加内容到单元格
    this.virtualDOM.appendChild(cellId, contentId);
  }

  /**
   * 更新列配置
   * 在列排序或其他列更改操作后调用，确保渲染器使用最新的列定义
   * @param columns 新的列定义数组
   */
  public updateColumns(columns: Column[]): void {
    if (!columns || !Array.isArray(columns)) {
      return;
    }
    
    // 更新选项中的列定义
    this.options.columns = [...columns];
  }
} 