import { EventBus } from '../eventbus/EventBus';
import { GridApi, RowNode, SortModel, FilterModel, Column } from '../types';

/**
 * GridEventBusHandler - 专门处理事件总线订阅和响应的类
 * 
 * 此类负责订阅并处理所有通过事件总线发送的事件，
 * 使Grid类能够更加专注于其核心功能，同时提供一个集中的地方管理所有事件处理逻辑。
 */
export class GridEventBusHandler {
  private api: GridApi;
  private eventBus: EventBus;

  /**
   * 构造函数
   * @param api Grid API引用
   * @param eventBus 事件总线实例
   */
  constructor(api: GridApi, eventBus: EventBus) {
    this.api = api;
    this.eventBus = eventBus;
    this.initSubscriptions();
  }

  /**
   * 初始化所有事件订阅
   */
  private initSubscriptions(): void {
    this.subscribeToSelectionEvents();
    this.subscribeToDataActions();
    this.subscribeToCellActions();
    this.subscribeToUIActions();
  }

  /**
   * 订阅选择事件
   */
  private subscribeToSelectionEvents(): void {
    this.eventBus.subscribe('gridSelectionChanged', (event) => {
      if (event.type === 'rowDeleted') {
        // 当行被删除时，刷新表头以更新选择状态
        this.api.refreshView();
      }
    });
  }

  /**
   * 订阅数据操作事件
   */
  private subscribeToDataActions(): void {
    this.eventBus.subscribe('gridDataAction', (event) => {
      // 处理行删除请求
      if (event.type === 'rowDeleteRequest') {
        const rowId = event.rowId;
        if (rowId !== undefined) {
          console.log(`处理删除行请求: ${rowId}, 来源: ${event.source}`);
          this.api.removeRow(rowId);
        }
      }
      // 处理行更新请求
      else if (event.type === 'rowUpdateRequest') {
        const { rowId, data, rowIndex } = event;
        if (rowId !== undefined && data) {
          console.log(`处理行数据更新请求: ${rowId}, 来源: ${event.source}`);
          
          // 更新行数据
          this.api.updateRowData(rowId, data);
          
          // 如果提供了行索引，刷新该行
          if (rowIndex !== undefined && rowIndex >= 0) {
            this.api.refreshRow(rowIndex);
          }
          
          // 发布数据已更新事件
          this.eventBus.publish('gridDataChanged', {
            type: 'rowUpdated',
            rowId: rowId,
            data: data,
            oldData: event.oldData,
            source: event.source
          });
        }
      }
      // 处理行添加请求
      else if (event.type === 'rowAddRequest') {
        const { data, position = 'bottom', autoScroll = true } = event;
        if (data) {
          console.log(`处理添加行请求, 位置: ${position}, 来源: ${event.source}`);
          this.api.addRow(data, position, autoScroll);
        }
      }
    });
  }

  /**
   * 订阅单元格操作事件
   */
  private subscribeToCellActions(): void {
    this.eventBus.subscribe('gridCellAction', (event) => {
      if (event.type === 'checkboxSelect') {
        if (event.action === 'select') {
          // 选择单行，保持其他选择状态
          this.api.selectRow(event.nodeId, !event.maintainOtherSelections);
        } else if (event.action === 'deselect') {
          // 使用新的API，直接取消选择单行，无需deselectAll再重选其他行
          // 这样可以大幅提高性能，特别是在树形表格中
          this.api.deselectRow(event.nodeId);
        } else if (event.action === 'toggle') {
          // 新增切换选择状态的操作
          this.api.toggleNodeSelection(event.nodeId);
        }
      } else if (event.type === 'headerCheckboxSelect') {
        if (event.action === 'selectAll') {
          this.api.selectAll();
        } else if (event.action === 'deselectAll') {
          this.api.deselectAll();
        }
      } else if (event.type === 'cellEditRequest') {
        // 处理单元格编辑请求
        const { rowId, field, value, cellElement, rowIndex } = event;
        console.log(`处理单元格编辑请求: 行ID=${rowId}, 字段=${field}, 来源=${event.source}`);
        
        // 如果提供了完整信息用于启动编辑
        if (cellElement && field) {
          // 获取行数据和列定义
          const rowNode = this.api.getRowNode(rowId);
          const colDef = this.api.getColumnDefs().find((col: Column) => col.field === field);
          
          if (rowNode && colDef && rowNode.data) {
            // 使用新添加的Grid API的startEditing方法
            this.api.startEditing(cellElement, colDef, rowNode.data, value);
            
            // 发布编辑开始事件
            this.eventBus.publish('gridUIChanged', {
              type: 'editStarted',
              rowId,
              field,
              value,
              source: event.source
            });
          }
        }
        // 如果只提供了基本信息用于设置值
        else if (rowId !== undefined && field) {
          this.api.setCellValues({ rowId, field, value });
          
          // 发布值变更事件
          this.eventBus.publish('gridDataChanged', {
            type: 'cellValueChanged',
            rowId,
            field,
            newValue: value,
            source: event.source
          });
        }
      }
    });
  }

  /**
   * 订阅UI操作事件
   */
  private subscribeToUIActions(): void {
    this.eventBus.subscribe('gridUIAction', (event) => {
      // 处理排序请求
      if (event.type === 'sortRequest') {
        const { colId, sort } = event;
        if (colId) {
          console.log(`处理排序请求: 列=${colId}, 排序=${sort}, 来源=${event.source}`);
          
          let sortModel: SortModel[] = [];
          if (sort) {
            // 如果指定了排序方向，创建排序模型
            sortModel = [{ colId, sort }];
          }
          
          // 应用排序
          this.api.setSort(sortModel);
          
          // 发布排序变更事件
          this.eventBus.publish('gridUIChanged', {
            type: 'sortChanged',
            sortModel: sortModel,
            source: event.source
          });
        }
      }
      // 处理过滤请求
      else if (event.type === 'filterRequest') {
        const { colId, filterModel } = event;
        if (colId) {
          console.log(`处理过滤请求: 列=${colId}, 来源=${event.source}`);
          
          if (filterModel) {
            // 应用过滤
            this.api.setFilter(colId, filterModel as FilterModel);
          } else {
            // 清除此列的过滤
            let currentFilterModel = this.api.getFilterModel();
            if (currentFilterModel && currentFilterModel[colId]) {
              delete currentFilterModel[colId];
              this.api.setFilterModel(currentFilterModel);
            }
          }
          
          // 发布过滤变更事件
          this.eventBus.publish('gridUIChanged', {
            type: 'filterChanged',
            colId: colId,
            filterModel: filterModel,
            source: event.source
          });
        } else if (event.action === 'clearAll') {
          // 清除所有过滤
          this.api.clearFilters();
          
          // 发布过滤清除事件
          this.eventBus.publish('gridUIChanged', {
            type: 'filterCleared',
            source: event.source
          });
        }
      }
      // 处理列宽调整请求
      else if (event.type === 'columnResizeRequest') {
        const { colId, width } = event;
        if (colId && width) {
          console.log(`处理列宽调整请求: 列=${colId}, 宽度=${width}, 来源=${event.source}`);
          // 处理列宽调整
          const columnDefs = this.api.getColumnDefs();
          const column = columnDefs.find(col => col.field === colId);
          if (column) {
            column.width = width;
            this.api.setColumnDefs(columnDefs);
            this.api.refreshView();
          }
        }
      }
      // 处理行可见性请求
      else if (event.type === 'ensureRowVisibleRequest') {
        const { rowIndex, position = 'middle' } = event;
        if (rowIndex !== undefined) {
          console.log(`处理行可见性请求: 行索引=${rowIndex}, 位置=${position}, 来源=${event.source}`);
          this.api.ensureIndexVisible(rowIndex, position);
        }
      }
      // 处理分页请求
      else if (event.type === 'pageChangeRequest') {
        const { pageNumber, pageSize } = event;
        console.log(`处理分页请求: 页码=${pageNumber}, 每页大小=${pageSize}, 来源=${event.source}`);
        // 假设API有分页方法
        // this.api.setPage(pageNumber, pageSize);
        
        // 发布分页变更事件
        this.eventBus.publish('gridUIChanged', {
          type: 'pageChanged',
          pageNumber,
          pageSize,
          source: event.source
        });
      }
      // 处理行展开/折叠请求
      else if (event.type === 'rowToggleRequest') {
        const { rowId, expanded } = event;
        if (rowId !== undefined) {
          console.log(`处理行展开/折叠请求: 行ID=${rowId}, 展开=${expanded}, 来源=${event.source}`);
          // 假设有展开/折叠行的API
          // this.api.toggleRowExpanded(rowId, expanded);
          
          // 发布行展开/折叠事件
          this.eventBus.publish('gridUIChanged', {
            type: 'rowToggled',
            rowId,
            expanded,
            source: event.source
          });
        }
      }
    });
  }

  /**
   * 注销所有订阅
   */
  public destroy(): void {
    // 目前EventBus没有提供按订阅者注销的方法
    // 如果EventBus实现了这样的功能，在这里调用
  }
} 