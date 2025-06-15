import { ComponentManager } from "./ComponentManager";
import { VirtualDOMManager } from "./VirtualDOMManager";
import { Column, ComponentParams, GridApi, GridOptions, RowNode } from "../types";
import { GridState } from "../interface";

/**
 * GridEditManager - 负责管理表格的单元格编辑功能
 */
export class GridEditManager {
  private virtualDOM: VirtualDOMManager;
  private componentManager: ComponentManager;
  private state: GridState;
  private rowNodes: Map<string | number, RowNode>;
  private getApi: () => GridApi;
  private originalEditValue: any;
  private renderCell: (cell: HTMLElement, column: Column, row: any, value: any, rowIndex: number) => void;
  private options: GridOptions;
  
  constructor(
    virtualDOM: VirtualDOMManager,
    componentManager: ComponentManager,
    state: GridState,
    rowNodes: Map<string | number, RowNode>,
    getApi: () => GridApi,
    renderCell: (cell: HTMLElement, column: Column, row: any, value: any, rowIndex: number) => void,
    options: GridOptions
  ) {
    this.virtualDOM = virtualDOM;
    this.componentManager = componentManager;
    this.state = state;
    this.rowNodes = rowNodes;
    this.getApi = getApi;
    this.renderCell = renderCell;
    this.options = options;
  }

  /**
   * 开始编辑单元格
   */
  public startEditing(
    cell: HTMLElement,
    column: Column,
    row: any,
    value: any
  ): void {
    // 如果已经在编辑，不要重复操作
    if (cell.classList.contains("editing")) return;

    const cellId = cell.getAttribute("data-element-id");
    if (!cellId) return;

    // 先处理可能存在的其他编辑单元格
    const existingEditCell = document.querySelector(".grid-cell.editing");
    if (existingEditCell && existingEditCell !== cell) {
      // 找到关联的数据并取消编辑
      const existingField = existingEditCell.getAttribute("data-field");
      const existingRowId = existingEditCell.closest(".grid-row")?.getAttribute("data-row-id");
      
      if (existingField && existingRowId) {
        const existingNode = this.rowNodes.get(existingRowId);
        if (existingNode) {
          const existingColumn = this.options.columns.find(c => c.field === existingField);
          if (existingColumn) {
            this.cancelEditing(existingEditCell as HTMLElement, existingColumn, existingNode.data);
          }
        }
      }
    }

    // 获取contentId
    const contentId = `${cellId}-content`;

    // 保存原始值用于取消编辑
    this.originalEditValue = row[column.field];

    // 设置编辑状态
    cell.classList.add("editing");
    this.virtualDOM.updateElement(cellId, {
      classes: ["grid-cell", "editable", "editing"],
    });

    // 隐藏视图组件
    const viewContainerId = `${contentId}-view`;
    const viewContainer = this.virtualDOM.getElement(viewContainerId);
    if (viewContainer) {
      viewContainer.style.display = "none";
    }

    // 创建编辑组件参数
    const node = this.rowNodes.get(row.id || row.rowIndex);
    if (!node) return;

    const params: ComponentParams = {
      value: this.originalEditValue,
      startValue: this.originalEditValue,
      data: row,
      rowIndex: node.rowIndex,
      colId: column.field,
      column,
      api: this.getApi(),
      node,
      onComplete: (newValue: any) => {
        document.removeEventListener("click", handleClickOutside);
        this.finishEditing(cell, column, row, newValue);
      },
      onCancel: () => {
        document.removeEventListener("click", handleClickOutside);
        this.cancelEditing(cell, column, row);
      },
      stopEditing: () => {
        document.removeEventListener("click", handleClickOutside);
        this.cancelEditing(cell, column, row);
      },
    };

    // 创建编辑组件
    const editComponentId = `${cellId}-edit`;
    const editComponent = this.componentManager.createEditComponent(
      editComponentId,
      column,
      params
    );

    // 创建或获取编辑容器
    const editContainerId = `${contentId}-edit`;
    let editContainer = this.virtualDOM.getElement(editContainerId);
    if (!editContainer) {
      this.virtualDOM.createElement(
        editContainerId,
        "div",
        "grid-cell-edit-container"
      );
      this.virtualDOM.updateElement(editContainerId, {
        styles: {
          overflow: "hidden",
          width: "100%",
          height: "100%",
          boxSizing: "border-box",
        },
      });
      editContainer = this.virtualDOM.getElement(editContainerId);
      if (editContainer) {
        this.virtualDOM.appendChild(contentId, editContainerId);
      }
    }

    // 显示并更新编辑容器
    if (editContainer) {
      editContainer.style.display = "flex";
      editContainer.innerHTML = "";

      // 处理特殊组件，确保它们不会溢出
      this.constrainEditComponent(editComponent, column);

      editContainer.appendChild(editComponent);

      // 尝试自动聚焦到输入元素
      setTimeout(() => {
        const input = editContainer.querySelector("input, select, textarea");
        if (input) {
          (input as HTMLElement).focus();
          if (input instanceof HTMLInputElement) {
            input.select();
          }
        }
      }, 0);
    }

    // 当前正在编辑的单元格信息存储起来
    this.state.editingCell = {
      rowId: row.id || row.rowIndex,
      field: column.field,
      value: this.originalEditValue
    };

    // 添加点击外部监听器
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // 如果点击的不是当前编辑的单元格或其子元素，则退出编辑模式
      if (!cell.contains(target)) {
        document.removeEventListener("click", handleClickOutside);
        // 点击外部时取消编辑，而不是保存
        this.cancelEditing(cell, column, row);
      }
    };

    // 延迟添加事件监听器，避免触发当前的点击事件
    setTimeout(() => {
      document.addEventListener("click", handleClickOutside);
    }, 0);
  }

  /**
   * 约束编辑组件，确保它不会溢出容器
   */
  private constrainEditComponent(component: HTMLElement, column: Column): void {
    // 对下拉菜单进行特殊处理
    const select = component.querySelector("select") as HTMLSelectElement;
    if (select) {
      select.style.width = "100%";
      select.style.maxWidth = "100%";
      select.style.overflow = "hidden";
      select.style.textOverflow = "ellipsis";
    }

    // 对输入框进行处理
    const input = component.querySelector("input") as HTMLInputElement;
    if (input) {
      input.style.width = "100%";
      input.style.maxWidth = "100%";
      input.style.boxSizing = "border-box";
    }

    // 对其他自定义组件进行处理
    const customElements = component.querySelectorAll("div");
    customElements.forEach((el) => {
      el.style.maxWidth = "100%";
      el.style.overflow = "hidden";
      el.style.textOverflow = "ellipsis";
    });
  }

  /**
   * 完成编辑并保存值
   */
  public finishEditing(
    cell: HTMLElement,
    column: Column,
    row: any,
    newValue: any
  ): void {
    const cellId = cell.getAttribute("data-element-id");
    if (!cellId) return;

    // 更新数据
    const oldValue = row[column.field];
    row[column.field] = newValue;

    // 移除编辑状态
    cell.classList.remove("editing");
    this.virtualDOM.updateElement(cellId, {
      classes: ["grid-cell", "editable"],
    });

    // 获取视图和编辑容器
    const contentId = `${cellId}-content`;
    const viewContainerId = `${contentId}-view`;
    const editContainerId = `${contentId}-edit`;
    const editComponentId = `${cellId}-edit`;

    // 隐藏编辑容器
    const editContainer = this.virtualDOM.getElement(editContainerId);
    if (editContainer) {
      editContainer.style.display = "none";
    }

    // 显示视图容器
    const viewContainer = this.virtualDOM.getElement(viewContainerId);
    if (viewContainer) {
      viewContainer.style.display = "block";
    }

    // 销毁编辑组件
    this.componentManager.destroyComponent(editComponentId);

    // 清空编辑状态
    this.state.editingCell = null;

    // 重新渲染视图组件以显示新值
    this.renderCell(cell, column, row, newValue, row.rowIndex);

    // 触发值变更事件
    if (this.options.onCellValueChanged) {
      const node = this.rowNodes.get(row.id);
      if (node) {
        this.options.onCellValueChanged({
          node,
          data: row,
          column,
          colId: column.field,
          value: newValue,
          oldValue: oldValue,
          newValue: newValue,
          event: new MouseEvent("click"),
        });
      }
    }
  }

  /**
   * 取消编辑，恢复原值
   */
  public cancelEditing(cell: HTMLElement, column: Column, row: any): void {
    if (!cell.classList.contains("editing")) return;

    const cellId = cell.getAttribute("data-element-id");
    if (!cellId) return;

    // 移除编辑状态
    cell.classList.remove("editing");
    this.virtualDOM.updateElement(cellId, {
      classes: ["grid-cell", "editable"],
    });

    // 获取视图和编辑容器
    const contentId = `${cellId}-content`;
    const viewContainerId = `${contentId}-view`;
    const editContainerId = `${contentId}-edit`;
    const editComponentId = `${cellId}-edit`;

    // 隐藏编辑容器
    const editContainer = this.virtualDOM.getElement(editContainerId);
    if (editContainer) {
      editContainer.style.display = "none";
    }

    // 显示视图容器
    const viewContainer = this.virtualDOM.getElement(viewContainerId);
    if (viewContainer) {
      viewContainer.style.display = "block";
    }

    // 销毁编辑组件
    this.componentManager.destroyComponent(editComponentId);

    // 清空编辑状态
    this.state.editingCell = null;

    // 重新渲染视图组件（使用原始值）
    this.renderCell(cell, column, row, row[column.field], row.rowIndex);
  }

  /**
   * 处理编辑开始事件
   */
  public handleEditStart(params: any): void {
    this.state.editingCell = params;
  }

  /**
   * 处理编辑结束事件
   */
  public handleEditEnd(save: boolean): void {
    if (this.state.editingCell) {
      if (save) {
        const { rowId, field, value } = this.state.editingCell;
        const node = this.rowNodes.get(rowId);
        if (node) {
          node.data[field] = value;
          const column = this.options.columns.find((c) => c.field === field);
          if (this.options.onCellValueChanged && column) {
            this.options.onCellValueChanged({
              node: node,
              data: node.data,
              column: column,
              colId: column.field,
              value: value,
              oldValue: undefined, // Old value is not tracked in this context
              newValue: value,
              event: null,
            });
          }
        }
      }
      this.state.editingCell = null;
    }
  }

  /**
   * 获取单元格编辑值
   */
  public getCellEditValue(cell: HTMLElement): any {
    const cellId = cell.getAttribute("data-element-id");
    if (!cellId) return null;

    const contentId = `${cellId}-content`;
    const inputId = `${contentId}-input`;

    // 检查标准输入编辑器
    const inputElement = this.virtualDOM.getElement(
      inputId
    ) as HTMLInputElement;
    if (inputElement) {
      // 确保数字类型输入返回有效数字，而不是NaN
      if (inputElement.type === "number") {
        // 先检查值是否与原值不同，如果没变化则返回原值
        if (inputElement.value === this.originalEditValue?.toString()) {
          return this.originalEditValue;
        }
        const numValue =
          inputElement.value.trim() === "" ? 0 : parseFloat(inputElement.value);
        return isNaN(numValue) ? 0 : numValue;
      }
      return inputElement.value;
    }

    // 检查自定义组件编辑器
    const componentContainerId = `${contentId}-component`;
    const componentContainer = this.virtualDOM.getElement(componentContainerId);
    if (componentContainer) {
      // 检查select元素
      const select = componentContainer.querySelector(
        "select"
      ) as HTMLSelectElement;
      if (select) {
        // 关键修复：检查select是否真的改变了值
        if (
          !select.dataset.hasChanged &&
          select.value === select.options[0].value
        ) {
          // 如果没有设置变更标记，且当前值是第一个选项，返回原始值
          return this.originalEditValue;
        }
        return select.value;
      }

      // 检查输入元素
      const input = componentContainer.querySelector(
        "input"
      ) as HTMLInputElement;
      if (input) {
        // 检查输入框是否真的被修改过
        if (input.type === "number") {
          // 先检查值是否与原值不同，如果没变化则返回原值
          if (input.value === this.originalEditValue?.toString()) {
            return this.originalEditValue;
          }
          const numValue =
            input.value.trim() === "" ? 0 : parseFloat(input.value);
          return isNaN(numValue) ? 0 : numValue; // 防止NaN值产生
        }
        return input.value;
      }

      // 如果没有找到输入元素，返回文本内容
      return componentContainer.textContent?.trim() || null;
    }

    return this.originalEditValue; // 默认返回原始值
  }
} 