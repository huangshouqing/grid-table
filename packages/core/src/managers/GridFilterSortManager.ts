import { Column, FilterModel, GridApi, GridOptions, SortModel } from "../types";
import { GridState } from "../interface";

/**
 * GridFilterSortManager - 负责管理表格的过滤和排序功能
 * 包括菜单显示、过滤条件应用、排序规则和数据处理等
 */
export class GridFilterSortManager {
  private element: HTMLElement;
  private state: GridState;
  private options: GridOptions;
  private getApi: () => GridApi;
  private refreshView: () => void;

  constructor(
    element: HTMLElement,
    state: GridState,
    options: GridOptions,
    getApi: () => GridApi,
    refreshView: () => void
  ) {
    this.element = element;
    this.state = state;
    this.options = options;
    this.getApi = getApi;
    this.refreshView = refreshView;
  }

  /**
   * 显示过滤菜单
   */
  public showFilterMenu(e: MouseEvent, column: Column): void {
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

  /**
   * 创建默认过滤菜单
   */
  private createDefaultFilterMenu(menu: HTMLElement, column: Column): void {
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

  /**
   * 处理排序点击事件
   */
  public handleSortClick(e: MouseEvent, column: Column): void {
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

  /**
   * 应用过滤器
   */
  public applyFilters(data: any[]): any[] {
    if (this.state.filterModel.size === 0) {
      return data;
    }

    return data.filter((item) => {
      // 每个过滤条件都要满足
      for (const [field, filterModel] of this.state.filterModel.entries()) {
        const value = item[field];
        const filterValue = filterModel.filter as string;

        // 如果值为空，但过滤值非空，不符合条件
        if ((value === null || value === undefined) && filterValue) {
          return false;
        }

        const strValue = String(value || "").toLowerCase();
        const strFilter = String(filterValue || "").toLowerCase();

        // 根据过滤类型进行不同的处理
        switch (filterModel.type) {
          case "equals":
            if (strValue !== strFilter) return false;
            break;
          case "notEqual":
            if (strValue === strFilter) return false;
            break;
          case "contains":
            if (!strValue.includes(strFilter)) return false;
            break;
          case "notContains":
            if (strValue.includes(strFilter)) return false;
            break;
          case "startsWith":
            if (!strValue.startsWith(strFilter)) return false;
            break;
          case "endsWith":
            if (!strValue.endsWith(strFilter)) return false;
            break;
        }
      }
      return true;
    });
  }

  /**
   * 应用排序
   */
  public applySort(data: any[]): any[] {
    if (this.state.sortModel.length === 0) {
      return data;
    }

    const { colId, sort } = this.state.sortModel[0];
    
    return [...data].sort((a, b) => {
      const valueA = a[colId];
      const valueB = b[colId];

      // 处理空值
      if (valueA === null || valueA === undefined) return sort === "asc" ? -1 : 1;
      if (valueB === null || valueB === undefined) return sort === "asc" ? 1 : -1;

      // 数字类型比较
      if (typeof valueA === "number" && typeof valueB === "number") {
        return sort === "asc" ? valueA - valueB : valueB - valueA;
      }

      // 日期类型比较
      if (valueA instanceof Date && valueB instanceof Date) {
        return sort === "asc"
          ? valueA.getTime() - valueB.getTime()
          : valueB.getTime() - valueA.getTime();
      }

      // 默认字符串比较
      const strA = String(valueA).toLowerCase();
      const strB = String(valueB).toLowerCase();
      
      return sort === "asc"
        ? strA.localeCompare(strB)
        : strB.localeCompare(strA);
    });
  }

  /**
   * 设置排序模型
   */
  public setSort(sortModel: SortModel[]): void {
    this.state.sortModel = sortModel;
    this.refreshView();
  }

  /**
   * 设置过滤模型
   */
  public setFilter(columnId: string, filterModel: FilterModel): void {
    this.state.filterModel.set(columnId, filterModel);
    this.refreshView();
  }

  /**
   * 获取过滤模型
   */
  public getFilterModel(): { [key: string]: FilterModel } {
    const model: { [key: string]: FilterModel } = {};
    this.state.filterModel.forEach((value, key) => {
      model[key] = value;
    });
    return model;
  }

  /**
   * 设置过滤模型
   */
  public setFilterModel(model: { [key: string]: FilterModel }): void {
    this.state.filterModel.clear();
    Object.entries(model).forEach(([key, value]) => {
      this.state.filterModel.set(key, value);
    });
    this.refreshView();
  }

  /**
   * 清除所有过滤条件
   */
  public clearFilters(): void {
    this.state.filterModel.clear();
    this.refreshView();
  }

  /**
   * 获取当前排序模型
   */
  public getSortModel(): SortModel[] {
    return this.state.sortModel;
  }

  /**
   * 检查是否有任何活动的过滤器
   */
  public isAnyFilterPresent(): boolean {
    return this.state.filterModel.size > 0;
  }
} 