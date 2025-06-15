import { Column, GridApi, GridOptions, RowNode, SortModel } from "../types";
import { GridState } from "../interface";

/**
 * GridDataManager - 负责管理表格的数据逻辑
 * 包括行节点处理、树形数据、过滤排序等数据相关操作
 */
export class GridDataManager {
  private state: GridState;
  private options: GridOptions;
  private rowNodes: Map<string | number, RowNode>;
  private getApi: () => GridApi;

  constructor(
    state: GridState,
    options: GridOptions,
    rowNodes: Map<string | number, RowNode>,
    getApi: () => GridApi
  ) {
    this.state = state;
    this.options = options;
    this.rowNodes = rowNodes;
    this.getApi = getApi;
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
    // 获取所有行节点
    const allNodes: RowNode[] = [];
    this.rowNodes.forEach((node) => {
      allNodes.push(node);
    });

    // 首先按照行索引排序，确保树形结构的正确顺序
    allNodes.sort((a, b) => a.rowIndex - b.rowIndex);

    // 过滤出可见的节点（考虑父子结构）
    const visibleNodes = this.getVisibleNodes(allNodes);

    // 应用过滤
    let filteredNodes = visibleNodes;
    if (this.state.filterModel.size > 0) {
      filteredNodes = visibleNodes.filter((node) => {
        return Array.from(this.state.filterModel.entries()).every(
          ([columnId, model]) => {
            const value = node.data[columnId];

            // 实现默认过滤逻辑
            if (model.filter && value !== undefined) {
              const filterValue = model.filter.toString().toLowerCase();
              const cellValue = value.toString().toLowerCase();

              switch (model.type) {
                case "equals":
                  return cellValue === filterValue;
                case "notEqual":
                  return cellValue !== filterValue;
                case "contains":
                  return cellValue.includes(filterValue);
                case "notContains":
                  return !cellValue.includes(filterValue);
                case "startsWith":
                  return cellValue.startsWith(filterValue);
                case "endsWith":
                  return cellValue.endsWith(filterValue);
                default:
                  return true;
              }
            }
            return true;
          }
        );
      });
    }

    // 应用排序（如果不是树形数据）
    if (this.state.sortModel.length > 0 && !this.hasTreeData()) {
      filteredNodes.sort((a, b) => {
        for (const sort of this.state.sortModel) {
          const column = this.options.columns.find(
            (col) => col.field === sort.colId
          );
          const valueA = a.data[sort.colId];
          const valueB = b.data[sort.colId];

          if (column?.comparator) {
            const result = column.comparator(valueA, valueB, a, b);
            if (result !== 0) return sort.sort === "asc" ? result : -result;
          } else {
            if (valueA < valueB) return sort.sort === "asc" ? -1 : 1;
            if (valueA > valueB) return sort.sort === "asc" ? 1 : -1;
          }
        }
        return 0;
      });
    }

    // 返回数据对象
    return filteredNodes.map((node) => node.data);
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