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
   * 保存当前所有节点的展开状态
   * @returns 节点ID到展开状态的映射
   */
  private saveExpandedState(): Map<string | number, boolean> {
    const expandedState = new Map<string | number, boolean>();
    
    this.rowNodes.forEach((node) => {
      // 只保存有子节点的节点的展开状态
      if (node.children && node.children.length > 0) {
        expandedState.set(node.id, !!node.expanded);
      }
    });
    
    return expandedState;
  }

  /**
   * 恢复节点的展开状态
   * @param expandedState 节点ID到展开状态的映射
   */
  private restoreExpandedState(expandedState: Map<string | number, boolean>): void {
    this.rowNodes.forEach((node) => {
      if (expandedState.has(node.id)) {
        node.expanded = expandedState.get(node.id)!;
      }
    });
  }

  /**
   * 初始化行节点，可选择保留展开状态
   * @param preserveExpandedState 是否保留节点的展开状态
   */
  public initRowNodes(preserveExpandedState: boolean = true): void {
    // 保存当前的展开状态
    const expandedState = preserveExpandedState ? this.saveExpandedState() : new Map();
    
    this.rowNodes.clear();
    if (Array.isArray(this.options.rowData)) {
      // 在处理树形数据之前，先递归地为所有节点设置初始的展开状态
      // 这确保了即使数据中没有明确提供 `expanded` 属性，我们也能正确处理
      const setInitialExpandedState = (nodes: any[], expanded: boolean) => {
        nodes.forEach(node => {
          // 如果有保存的状态，优先使用保存的状态
          if (preserveExpandedState && expandedState.has(node.id)) {
            node.expanded = expandedState.get(node.id);
          } else if (node.expanded === undefined) {
            node.expanded = expanded;
          }
          if (node.children) {
            // 子节点默认折叠，除非有保存的状态
            setInitialExpandedState(node.children, false);
          }
        });
      };

      // 顶级节点默认展开
      if (this.options.treeData) {
        setInitialExpandedState(this.options.rowData, true);
      }
      
      this.processTreeData(this.options.rowData);
      
      // 恢复展开状态
      if (preserveExpandedState) {
        this.restoreExpandedState(expandedState);
      }
    }
  }

  /**
   * 递归处理行数据，构建RowNode树
   */
  public processTreeData(
    rowData: any[],
    parent: RowNode | null = null,
    level: number = 0
  ) {
    rowData.forEach((data, index) => {
      // 优先使用data.id，如果没有，则基于父节点和索引创建唯一ID
      const id = data.id !== undefined ? data.id : `${parent ? parent.id + '-' : ''}${index}`;
      
      // 检查节点是否已存在，以保留其状态（如展开/折叠状态）
      const existingNode = this.rowNodes.get(id);

      const node: RowNode = {
        id: id,
        data: data,
        rowIndex: this.rowNodes.size,
        level: level,
        parent: parent || undefined,
        // 保留现有状态，如果数据中有定义则使用，否则默认为 false
        expanded: existingNode ? existingNode.expanded : (data.expanded !== undefined ? data.expanded : false),
        selected: this.state.selectedNodes.has(id),
        children: [], // 初始化children数组
      };
      this.rowNodes.set(id, node);

      if (parent) {
        parent.children!.push(node);
      }

      if (data.children && Array.isArray(data.children) && data.children.length > 0) {
        this.processTreeData(data.children, node, level + 1);
      }
    });
  }

  /**
   * 递归地获取所有可见的节点
   * @param nodes 要开始遍历的节点列表（通常是根节点）
   * @returns 返回一个包含所有可见节点的扁平化数组
   */
  public getVisibleNodes(nodes: RowNode[]): RowNode[] {
    const visibleNodes: RowNode[] = [];
    // 深度优先遍历，确保子节点直接跟在父节点后面
    for (const node of nodes) {
      visibleNodes.push(node);
      // 如果节点已展开并且有子节点，则先处理所有子节点
      if (node.expanded && node.children && node.children.length > 0) {
        // 递归获取子节点，并直接添加到父节点后面
        const childNodes = this.getVisibleNodes(node.children);
        visibleNodes.push(...childNodes);
      }
    }
    return visibleNodes;
  }

  /**
   * 获取过滤和排序后的数据
   */
  public getFilteredAndSortedData(): any[] {
    let visibleNodes: RowNode[];

    // 如果是树形数据，先获取所有可见的节点，保持树形结构
    if (this.options.treeData) {
      // 获取所有根节点
      const rootNodes = Array.from(this.rowNodes.values()).filter(node => !node.parent);
      
      // 获取树形结构下所有可见节点（深度优先顺序）
      visibleNodes = this.getVisibleNodes(rootNodes);

      // 无需按ID排序，因为我们已经确保了树形结构的正确顺序
      // 节点顺序现在是：父节点->子节点->子节点->...->下一个父节点
    } else {
      // 非树形数据，所有节点都可见
      visibleNodes = Array.from(this.rowNodes.values());

      // 对于普通数据，我们仍然按照原始数据顺序排序
      if (this.options.rowData && Array.isArray(this.options.rowData)) {
        // 创建ID到索引的映射
        const idToIndex = new Map();
        this.options.rowData.forEach((row, index) => {
          idToIndex.set(row.id, index);
        });
        
        // 按照原始数据顺序排序节点
        visibleNodes.sort((a, b) => {
          const indexA = idToIndex.get(a.id) ?? 0;
          const indexB = idToIndex.get(b.id) ?? 0;
          return indexA - indexB;
        });
      }
    }
    
    // 更新行索引，确保行索引与视图顺序一致
    visibleNodes.forEach((node, index) => {
      node.rowIndex = index;
    });

    // 从可见节点中提取数据
    let result = visibleNodes.map(node => node.data);

    // 应用过滤器和排序器，但对于树形数据我们需要谨慎处理
    if (this.options.treeData) {
      // 树形数据中，我们可以应用过滤器但要小心排序（可能破坏层级关系）
      if (this.filterSortManager) {
        // 只应用过滤，对于树形数据，排序可能会破坏父子关系
        result = this.filterSortManager.applyFilters(result);
      } else if (this.state.filterModel.size > 0) {
        result = this.applyFilters(result);
      }
    } else {
      // 非树形数据，正常应用过滤和排序
      if (this.filterSortManager) {
        result = this.filterSortManager.applyFilters(result);
        result = this.filterSortManager.applySort(result);
      } else {
        if (this.state.filterModel.size > 0) {
          result = this.applyFilters(result);
        }
        if (this.state.sortModel.length > 0) {
          result = this.applySort(result);
        }
      }
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
   * 检查是否为树形数据
   * @deprecated 应该直接使用 this.options.treeData
   */
  public hasTreeData(): boolean {
    return this.options.treeData === true;
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
   * 添加新行数据
   * @param data 要添加的行数据
   * @param position 添加位置("top" 或 "bottom")
   * @returns a new row node
   */
  public addRow(data: any, position: "top" | "bottom" = "bottom"): RowNode {
    // 确保数据有ID
    if (data.id === undefined) {
      data.id = `row-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    
    const id = data.id;
    // console.log(`[GridDataManager.addRow] 添加行 id=${id}, position=${position}`);
    
    // 创建新的行节点
    const newNode: RowNode = {
      id: id,
      data: data,
      rowIndex: position === 'top' ? 0 : (this.options.rowData?.length || 0),
      selected: false,
      children: [],
      level: 0,
    };

    // 更新rowNodes映射
    this.rowNodes.set(id, newNode);

    // 更新原始数据数组
    if (this.options.rowData) {
      if (position === 'top') {
        // console.log(`[GridDataManager.addRow] 添加行到顶部，更新前行数=${this.options.rowData.length}`);
        this.options.rowData.unshift(data);
        // console.log(`[GridDataManager.addRow] 添加后行数=${this.options.rowData.length}`);
        
        // 更新所有其他节点的行索引，确保与原始数据顺序一致
        this.updateAllRowIndices();
      } else {
        // console.log(`[GridDataManager.addRow] 添加行到底部，更新前行数=${this.options.rowData.length}`);
        this.options.rowData.push(data);
        // console.log(`[GridDataManager.addRow] 添加后行数=${this.options.rowData.length}`);
        
        // 底部添加也更新一下所有行索引，保持一致性
        this.updateAllRowIndices();
      }
    } else {
      // 如果rowData不存在，则创建新的数组
      this.options.rowData = [data];
    }
    
    // 如果有排序，我们需要确保行位置正确
    if (this.filterSortManager && this.filterSortManager.getSortModel().length > 0) {
      // console.log(`[GridDataManager.addRow] 存在排序，重新初始化所有行节点`);
      this.initRowNodes();
      return this.rowNodes.get(id) || newNode;
    }
    
    // 如果有树形结构，需要重新初始化
    if (this.options.treeData) {
      // console.log(`[GridDataManager.addRow] 树形数据，重新初始化所有行节点`);
      this.initRowNodes();
      return this.rowNodes.get(id) || newNode;
    }
    
    return newNode;
  }

  /**
   * 更新所有行的索引
   */
  private updateAllRowIndices(): void {
    if (!Array.isArray(this.options.rowData)) return;
    
    // console.log(`[updateAllRowIndices] 更新所有行索引，当前行数=${this.options.rowData.length}`);
    
    // 创建ID到索引的映射
    const idToIndex = new Map();
    this.options.rowData.forEach((row, index) => {
      idToIndex.set(row.id, index);
    });
    
    // 更新所有节点的行索引
    this.rowNodes.forEach((node) => {
      const index = idToIndex.get(node.id);
      if (index !== undefined) {
        node.rowIndex = index;
        // console.log(`[updateAllRowIndices] 更新行 id=${node.id}, 新索引=${index}`);
      }
    });
  }

  /**
   * 删除指定ID的行
   */
  public removeRow(id: string | number): void {
    if (!Array.isArray(this.options.rowData)) return;

    const removeRecursively = (rows: any[], targetId: string | number): boolean => {
      const index = rows.findIndex((row) => row.id === targetId);
      if (index !== -1) {
        rows.splice(index, 1);
        return true;
      }
      for (const row of rows) {
        if (row.children && removeRecursively(row.children, targetId)) {
          return true;
        }
      }
      return false;
    };

    if (removeRecursively(this.options.rowData, id)) {
      this.rowNodes.delete(id);
      this.initRowNodes();
    }
  }

  /**
   * 移动行.
   * 注意: 当开启排序或过滤时，此功能将被禁用，因为索引会变得不可靠。
   */
  public moveRow(fromIndex: number, toIndex: number): RowNode | null {
    // 检查是否有活动的排序或过滤
    if (this.filterSortManager) {
      if (this.filterSortManager.isAnyFilterPresent() || this.filterSortManager.getSortModel().length > 0) {
        console.warn("Row dragging is disabled when sorting or filtering is active to prevent data corruption.");
        return null;
      }
    }
    
    // 如果没有排序和过滤，我们可以安全地假设显示的索引与 rowData 中的索引一致
    const rowData = this.options.rowData;
    if (
      !Array.isArray(rowData) ||
      fromIndex < 0 ||
      fromIndex >= rowData.length ||
      toIndex < 0 ||
      toIndex > rowData.length
    ) {
      console.warn(`[moveRow] 索引无效: fromIndex=${fromIndex}, toIndex=${toIndex}, rowData.length=${rowData?.length}`);
      return null;
    }

    // console.log(`[moveRow] 开始移动行: fromIndex=${fromIndex}, toIndex=${toIndex}, rowData.length=${rowData.length}`);
    
    // 移动数据行
    const [movedRow] = rowData.splice(fromIndex, 1);
    rowData.splice(toIndex, 0, movedRow);
    
    // console.log(`[moveRow] 已移动行 id=${movedRow.id}, 从${fromIndex}到${toIndex}`);

    // 更新所有行索引，确保与原始数据顺序一致
    this.updateAllRowIndices();
    
    // 返回移动后的行节点
    const movedNode = this.rowNodes.get(movedRow.id);
    if (movedNode) {
      // console.log(`[moveRow] 返回移动后的节点: id=${movedNode.id}, rowIndex=${movedNode.rowIndex}`);
    } else {
      console.warn(`[moveRow] 无法找到移动后的节点: id=${movedRow.id}`);
    }
    return movedNode || null;
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