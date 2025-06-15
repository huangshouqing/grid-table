import { Column, FilterModel, GridApi, GridOptions, RowNode, SortModel } from "../types";
import { GridState } from "../interface";
import { GridFilterSortManager } from "./GridFilterSortManager";

/**
 * GridDataManager - 负责管理表格的数据逻辑
 * 包括行节点处理、树形数据、过滤排序等数据相关操作
 */
export class GridDataManager {
  private state: GridState;
  private options: GridOptions;
  private rowNodes: Map<string | number, RowNode>;
  private getApi: () => GridApi;
  private filterSortManager?: GridFilterSortManager;

  constructor(
    state: GridState,
    options: GridOptions,
    rowNodes: Map<string | number, RowNode>,
    getApi: () => GridApi,
    filterSortManager?: GridFilterSortManager
  ) {
    this.state = state;
    this.options = options;
    this.rowNodes = rowNodes;
    this.getApi = getApi;
    this.filterSortManager = filterSortManager;
  }

  /**
   * 设置FilterSortManager引用
   * 可在初始化后设置，解决循环依赖问题
   */
  public setFilterSortManager(manager: GridFilterSortManager): void {
    this.filterSortManager = manager;
  }

  /**
   * 初始化行节点
   */
  public initRowNodes(): void {
    this.rowNodes.clear();
    if (Array.isArray(this.options.rowData)) {
      // 检查数据是否包含层级结构
      const hasTreeData = this.options.rowData.some(
        (data) =>
          data.children &&
          Array.isArray(data.children) &&
          data.children.length > 0
      );

      if (hasTreeData) {
        // 处理树形数据
        this.processTreeData(this.options.rowData);
      } else {
        // 处理普通数据
        this.options.rowData.forEach((data, index) => {
          const id = data.id || index;
          const node: RowNode = {
            id: id,
            data,
            rowIndex: index,
            selected: this.state.selectedNodes.has(id), // 检查节点是否之前已选中
            level: 0,
            expanded: true,
          };
          this.rowNodes.set(node.id, node);
        });
      }
    }
  }

  /**
   * 处理树形数据
   */
  public processTreeData(
    rowData: any[],
    parentNode?: RowNode,
    level: number = 0
  ): void {
    if (!Array.isArray(rowData)) return;

    rowData.forEach((data, index) => {
      const id = data.id || `${parentNode ? parentNode.id + "_" : ""}${index}`;
      const node: RowNode = {
        id: id,
        data,
        rowIndex: this.rowNodes.size, // 使用当前节点数作为行索引
        selected: this.state.selectedNodes.has(id), // 检查节点是否之前已选中
        level,
        expanded: data.expanded !== undefined ? data.expanded : true,
        parent: parentNode,
      };

      // 处理子节点
      if (
        data.children &&
        Array.isArray(data.children) &&
        data.children.length > 0
      ) {
        node.children = [];
        this.rowNodes.set(node.id, node);

        // 递归处理子节点
        this.processTreeData(data.children, node, level + 1);

        // 将子节点添加到父节点的children数组中
        data.children.forEach((childData: any) => {
          const childId = childData.id || `${node.id}_${node.children!.length}`;
          const childNode = this.rowNodes.get(childId);
          if (childNode) {
            node.children!.push(childNode);
          }
        });
      } else {
        this.rowNodes.set(node.id, node);
      }
    });
  }

  /**
   * 获取过滤和排序后的数据
   */
  public getFilteredAndSortedData(): any[] {
    if (!this.options.rowData) return [];

    let result = [...this.options.rowData];

    // 如果已经设置了filterSortManager，则使用它的过滤和排序功能
    if (this.filterSortManager) {
      result = this.filterSortManager.applyFilters(result);
      result = this.filterSortManager.applySort(result);
      return result;
    }

    // 如果没有filterSortManager，则使用内部过滤和排序逻辑（兼容旧代码）
    // 应用过滤器
    if (this.state.filterModel.size > 0) {
      result = this.applyFilters(result);
    }

    // 应用排序
    if (this.state.sortModel.length > 0) {
      result = this.applySort(result);
    }

    return result;
  }

  /**
   * 应用过滤器（旧方法，为兼容保留）
   * @deprecated 请使用 filterSortManager.applyFilters
   */
  private applyFilters(data: any[]): any[] {
    return data.filter((item) => {
      for (const [field, filterModel] of this.state.filterModel.entries()) {
        const value = item[field];
        const filterValue = filterModel.filter as string;

        if ((value === null || value === undefined) && filterValue) {
          return false;
        }

        const strValue = String(value || "").toLowerCase();
        const strFilter = String(filterValue || "").toLowerCase();

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
   * 应用排序（旧方法，为兼容保留）
   * @deprecated 请使用 filterSortManager.applySort
   */
  private applySort(data: any[]): any[] {
    const { colId, sort } = this.state.sortModel[0];

    return [...data].sort((a, b) => {
      const valueA = a[colId];
      const valueB = b[colId];

      if (valueA === null || valueA === undefined) return sort === "asc" ? -1 : 1;
      if (valueB === null || valueB === undefined) return sort === "asc" ? 1 : -1;

      if (typeof valueA === "number" && typeof valueB === "number") {
        return sort === "asc" ? valueA - valueB : valueB - valueA;
      }

      if (valueA instanceof Date && valueB instanceof Date) {
        return sort === "asc"
          ? valueA.getTime() - valueB.getTime()
          : valueB.getTime() - valueA.getTime();
      }

      const strA = String(valueA).toLowerCase();
      const strB = String(valueB).toLowerCase();
      
      return sort === "asc"
        ? strA.localeCompare(strB)
        : strB.localeCompare(strA);
    });
  }

  /**
   * 获取可见的节点（考虑树形结构的展开/折叠状态）
   */
  public getVisibleNodes(allNodes: RowNode[]): RowNode[] {
    const visibleNodes: RowNode[] = [];

    // 如果没有树形数据，直接返回所有节点
    if (!this.hasTreeData()) {
      return allNodes;
    }

    // 获取根节点（没有父节点的节点）
    const rootNodes = allNodes.filter((node) => !node.parent);

    // 递归添加可见节点
    for (const rootNode of rootNodes) {
      this.addVisibleNode(rootNode, visibleNodes);
    }

    return visibleNodes;
  }

  /**
   * 递归添加可见节点
   */
  public addVisibleNode(node: RowNode, visibleNodes: RowNode[]): void {
    // 添加当前节点
    visibleNodes.push(node);

    // 如果节点展开且有子节点，递归添加子节点
    if (node.expanded && node.children && node.children.length > 0) {
      // 查找子节点
      const childNodes: RowNode[] = [];
      this.rowNodes.forEach((possibleChild) => {
        if (possibleChild.parent === node) {
          childNodes.push(possibleChild);
        }
      });

      // 按行索引排序
      childNodes.sort((a, b) => a.rowIndex - b.rowIndex);

      // 递归添加每个子节点
      for (const childNode of childNodes) {
        this.addVisibleNode(childNode, visibleNodes);
      }
    }
  }

  /**
   * 检查是否有树形数据
   */
  public hasTreeData(): boolean {
    let hasTree = false;
    this.rowNodes.forEach((node) => {
      if (node.level && node.level > 0) {
        hasTree = true;
      }
    });
    return hasTree;
  }

  /**
   * 更新行索引
   */
  public updateRowIndices(startIndex: number, endIndex: number): void {
    if (!Array.isArray(this.options.rowData)) return;

    // 更新受影响行的索引
    for (let i = startIndex; i < this.options.rowData.length; i++) {
      const data = this.options.rowData[i];
      const node = this.rowNodes.get(data.id !== undefined ? data.id : i);
      if (node) {
        node.rowIndex = i;
      }
    }
  }

  /**
   * 添加新行
   */
  public addRow(data: any, position: "top" | "bottom" = "bottom"): void {
    // 确保rowData是数组
    if (!Array.isArray(this.options.rowData)) {
      this.options.rowData = [];
    }

    // 生成唯一ID
    if (data.id === undefined) {
      data.id = Date.now() + Math.floor(Math.random() * 1000);
    }

    // 根据位置添加数据
    if (position === "top") {
      this.options.rowData.unshift(data);
    } else {
      this.options.rowData.push(data);
    }

    // 重新初始化行节点
    this.initRowNodes();
  }

  /**
   * 删除行
   */
  public removeRow(id: string | number): void {
    if (!Array.isArray(this.options.rowData)) return;

    const index = this.options.rowData.findIndex((row) => row.id === id);
    if (index !== -1) {
      this.options.rowData.splice(index, 1);
      this.rowNodes.delete(id);
      this.initRowNodes();
    }
  }

  /**
   * 移动行
   */
  public moveRow(fromIndex: number, toIndex: number): RowNode | undefined {
    if (
      !Array.isArray(this.options.rowData) ||
      fromIndex < 0 ||
      fromIndex >= this.options.rowData.length ||
      toIndex < 0 ||
      toIndex > this.options.rowData.length
    ) {
      return undefined;
    }

    // 移动数据行
    const row = this.options.rowData.splice(fromIndex, 1)[0];
    this.options.rowData.splice(toIndex, 0, row);

    // 更新受影响行的索引而不是完全重新初始化
    this.updateRowIndices(Math.min(fromIndex, toIndex), Math.max(fromIndex, toIndex));
    
    // 返回移动后的行节点
    return this.rowNodes.get(row.id);
  }

  /**
   * 获取节点
   */
  public getRowNode(id: string | number): RowNode | undefined {
    return this.rowNodes.get(id);
  }

  /**
   * 获取显示的行数量
   */
  public getDisplayedRowCount(): number {
    return this.getFilteredAndSortedData().length;
  }

  /**
   * 根据索引获取显示的行节点
   */
  public getDisplayedRowAtIndex(index: number): RowNode | undefined {
    const data = this.getFilteredAndSortedData()[index];
    return data ? this.rowNodes.get(data.id) : undefined;
  }
} 