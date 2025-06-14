import {
    Column,
    GridOptions,
    RowNode,
    GridApi,
    SortModel,
    FilterModel,
    ValueSetParams,
    ComponentParams,
    CellComponent,
    RowDragEndEvent,
    SelectionChangedEvent
} from './types/index';
import { ScrollSyncManager } from './managers/ScrollSyncManager';
import { VirtualDOMManager } from './managers/VirtualDOMManager';
import { EventManager } from './managers/EventManager';
import { ComponentManager } from './managers/ComponentManager';
import { GridState } from './interface';
import { CheckboxCellRenderer, CheckboxHeaderRenderer } from './renderers/CheckboxCellRenderer';
import { RowDragRenderer } from './renderers/RowDragRenderer';
import { TreeCellRenderer } from './renderers/TreeCellRenderer';
// 添加状态管理

export class Grid implements GridApi {
    private state: GridState;
    private virtualDOM: VirtualDOMManager;
    private eventManager: EventManager;
    private scrollSyncManager: ScrollSyncManager;
    private componentManager: ComponentManager;
    private options: GridOptions;
    private element: HTMLElement;
    private rowNodes: Map<string | number, RowNode> = new Map();

    private originalEditValue: any;
    private lastScrollTop: number = 0;
    private lastScrollLeft: number = 0;
    private readonly instanceId: string;

    constructor(options: GridOptions) {
        this.instanceId = `grid-${Math.random().toString(36).substr(2, 9)}`;
        this.options = {
            rowHeight: 40,
            headerHeight: 40,
            ...options
        };

        this.state = {
            scrollPosition: {
                left: 0,
                top: 0,
                lastLeft: 0,
                lastTop: 0
            },
            editingCell: null,
            selectedNodes: new Set(),
            sortModel: [],
            filterModel: new Map(),
            columnState: new Map(options.columns.map((col, index) => [
                col.field,
                { width: col.width, visible: true, order: index }
            ])),
            dragState: {
                draggedColumn: null,
                draggedElement: null,
                resizeStartX: 0,
                resizeColumn: null,
                resizeElement: null
            },
            virtualBodyRowIds: new Set<string>()
        };

        this.element = document.createElement('div');
        this.element.className = 'grid-container';
        
        this.virtualDOM = new VirtualDOMManager(this);
        this.scrollSyncManager = new ScrollSyncManager();
        this.eventManager = new EventManager();
        this.componentManager = new ComponentManager();

        this.initRowNodes();
        this.initializeEventListeners();
        this.initializeDragToFill();
        this.initializeDragAndDropListeners();
    }

    private initializeEventListeners() {
        this.eventManager.on('scroll', this.handleScroll);
        this.eventManager.on('selectionChange', this.handleSelectionChange);
        this.eventManager.on('sortChange', this.handleSortChange);
        this.eventManager.on('filterChange', this.handleFilterChange);
        this.eventManager.on('editStart', this.handleEditStart);
        this.eventManager.on('editEnd', this.handleEditEnd);
        
        // 初始化行拖拽事件
        if (this.options.enableRowDrag) {
            this.initializeRowDragEvents();
        }
    }

    private initializeRowDragEvents() {
        // 添加拖拽相关事件监听
        this.element.addEventListener('dragover', this.handleRowDragOver);
        this.element.addEventListener('drop', this.handleRowDrop);
        this.element.addEventListener('dragend', this.handleRowDragEnd);
    }
    
    private handleRowDragOver = (e: DragEvent) => {
        e.preventDefault();
        if (!e.dataTransfer) return;
        
        e.dataTransfer.dropEffect = 'move';
        
        // 获取目标行
        const targetRow = (e.target as HTMLElement).closest('.grid-row') as HTMLElement;
        if (!targetRow) return;
        
        // 移除所有拖拽指示器
        const allRows = this.element.querySelectorAll('.grid-row');
        allRows.forEach(row => {
            row.classList.remove('grid-row-drag-above', 'grid-row-drag-below');
        });
        
        // 确定拖拽位置（上方或下方）
        const rect = targetRow.getBoundingClientRect();
        const middleY = rect.top + rect.height / 2;
        const isAbove = e.clientY < middleY;
        
        // 添加拖拽指示器
        if (isAbove) {
            targetRow.classList.add('grid-row-drag-above');
        } else {
            targetRow.classList.add('grid-row-drag-below');
        }
    }
    
    private handleRowDrop = (e: DragEvent) => {
        e.preventDefault();
        if (!e.dataTransfer) return;
        
        try {
            // 获取拖拽数据
            const dragData = JSON.parse(e.dataTransfer.getData('application/json'));
            const { rowId, rowIndex: fromIndex } = dragData;
            
            // 获取目标行
            const targetRow = (e.target as HTMLElement).closest('.grid-row') as HTMLElement;
            if (!targetRow) return;
            
            const targetRowId = targetRow.getAttribute('data-row-id');
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
            this.moveRow(fromIndex, actualToIndex);
            
            // 移除所有拖拽指示器
            const allRows = this.element.querySelectorAll('.grid-row');
            allRows.forEach(row => {
                row.classList.remove('grid-row-drag-above', 'grid-row-drag-below', 'grid-row-dragging');
            });
        } catch (error) {
            console.error('Error handling row drop:', error);
        }
    }
    
    private handleRowDragEnd = () => {
        // 移除所有拖拽指示器
        const allRows = this.element.querySelectorAll('.grid-row');
        allRows.forEach(row => {
            row.classList.remove('grid-row-drag-above', 'grid-row-drag-below', 'grid-row-dragging');
        });
    }

    private handleScroll = (scrollLeft: number, scrollTop: number) => {
        this.state.scrollPosition = { 
            top: scrollTop, 
            left: scrollLeft, 
            lastLeft: this.state.scrollPosition.left,
            lastTop: this.state.scrollPosition.top
        };
        this.refreshView();
    };

    private handleSelectionChange = () => {
        this.refreshView();
    };

    private handleSortChange = () => {
        this.refreshView();
    };

    private handleFilterChange = () => {
        this.refreshView();
    };

    private handleEditStart = (params: any) => {
        this.state.editingCell = params;
        this.refreshView();
    };

    private handleEditEnd = (save: boolean) => {
        if (this.state.editingCell) {
            if (save) {
                const { rowId, field, value } = this.state.editingCell;
                const node = this.rowNodes.get(rowId);
                if (node) {
                    node.data[field] = value;
                    if (this.options.onCellValueChanged) {
                        const column = this.options.columns.find(c => c.field === field);
                        if (column) {
                            this.options.onCellValueChanged({
                                node: node,
                                data: node.data,
                                column: column,
                                colId: column.field,
                                value: value,
                                oldValue: undefined, // Old value is not tracked in this context
                                newValue: value,
                                event: null
                            });
                        }
                    }
                }
            }
            this.state.editingCell = null;
            this.refreshView();
        }
    };

    private initRowNodes() {
        this.rowNodes.clear();
        if (Array.isArray(this.options.rowData)) {
            // 检查数据是否包含层级结构
            const hasTreeData = this.options.rowData.some(data => 
                data.children && Array.isArray(data.children) && data.children.length > 0
            );
            
            if (hasTreeData) {
                // 处理树形数据
                this.processTreeData(this.options.rowData);
            } else {
                // 处理普通数据
                this.options.rowData.forEach((data, index) => {
                    const node: RowNode = {
                        id: data.id || index,
                        data,
                        rowIndex: index,
                        selected: false,
                        level: 0,
                        expanded: true
                    };
                    this.rowNodes.set(node.id, node);
                });
            }
        }
    }
    
    private processTreeData(rowData: any[], parentNode?: RowNode, level: number = 0) {
        if (!Array.isArray(rowData)) return;
        
        rowData.forEach((data, index) => {
            const node: RowNode = {
                id: data.id || `${parentNode ? parentNode.id + '_' : ''}${index}`,
                data,
                rowIndex: this.rowNodes.size, // 使用当前节点数作为行索引
                selected: false,
                level,
                expanded: data.expanded !== undefined ? data.expanded : true,
                parent: parentNode
            };
            
            // 处理子节点
            if (data.children && Array.isArray(data.children) && data.children.length > 0) {
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

    private renderHeader() {
        const headerWrapperId = `${this.instanceId}-header-wrapper`;
        this.virtualDOM.createElement(headerWrapperId, 'div', 'grid-header');
        this.virtualDOM.updateElement(headerWrapperId, {
            styles: {
                display: 'flex',
                overflow: 'hidden'
            }
        });

        const headerId = `${this.instanceId}-header`;
        this.virtualDOM.createElement(headerId, 'div');
        this.virtualDOM.updateElement(headerId, {
            styles: {
                display: 'flex',
                height: `${this.options.headerHeight}px`,
                flex: '1',
                position: 'relative',
                minWidth: 'fit-content'
            }
        });

        this.options.columns.forEach((col) => {
            const cellId = `${this.instanceId}-header-cell-${col.field}`;
            this.virtualDOM.createElement(cellId, 'div', 'grid-header-cell');
            
            this.virtualDOM.updateElement(cellId, {
                attributes: {
                    'data-field': col.field,
                    'draggable': col.rowDrag ? 'false' : 'true'
                },
                styles: {
                    width: `${col.width}px`
                }
            });

            // 处理复选框列
            if (col.checkboxSelection) {
                const checkboxContainerId = `${cellId}-checkbox-container`;
                this.virtualDOM.createElement(checkboxContainerId, 'div', 'grid-header-checkbox-container');
                
                // 创建复选框头部渲染器
                const headerCheckboxId = `${this.instanceId}-header-checkbox-${col.field}`;
                const headerCheckbox = new CheckboxHeaderRenderer();
                headerCheckbox.init({
                    api: this,
                    column: col
                });
                
                const headerCheckboxElement = headerCheckbox.getGui();
                
                // 将复选框元素添加到容器
                const checkboxContainer = this.virtualDOM.getElement(checkboxContainerId);
                if (checkboxContainer) {
                    // 清空容器，避免重复添加
                    checkboxContainer.innerHTML = '';
                    checkboxContainer.appendChild(headerCheckboxElement);
                }
                
                this.virtualDOM.appendChild(cellId, checkboxContainerId);
                this.virtualDOM.appendChild(headerId, cellId);
                return; // 跳过后续处理
            }

            // 处理行拖拽列
            if (col.rowDrag) {
                const dragContainerId = `${cellId}-drag-container`;
                this.virtualDOM.createElement(dragContainerId, 'div', 'grid-header-drag-container');
                
                // 创建拖拽图标
                const dragIconId = `${this.instanceId}-header-drag-icon-${col.field}`;
                this.virtualDOM.createElement(dragIconId, 'div', 'grid-header-drag-icon');
                this.virtualDOM.updateElement(dragIconId, {
                    content: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M8 6H10V8H8V6Z" fill="currentColor"/>
                        <path d="M14 6H16V8H14V6Z" fill="currentColor"/>
                        <path d="M8 10H10V12H8V10Z" fill="currentColor"/>
                        <path d="M14 10H16V12H14V10Z" fill="currentColor"/>
                        <path d="M8 14H10V16H8V14Z" fill="currentColor"/>
                        <path d="M14 14H16V16H14V14Z" fill="currentColor"/>
                    </svg>`
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
            this.virtualDOM.createElement(titleContainerId, 'div', 'grid-header-cell-content');
            
            const titleId = `${this.instanceId}-header-title-${col.field}`;
            this.virtualDOM.createElement(titleId, 'div', 'grid-header-cell-title');
            this.virtualDOM.updateElement(titleId, {
                content: col.headerName
            });

            const actionContainerId = `${this.instanceId}-header-actions-${col.field}`;
            this.virtualDOM.createElement(actionContainerId, 'div', 'grid-header-cell-actions');

            if (col.sortable) {
                const sortButtonId = `${this.instanceId}-sort-button-${col.field}`;
                this.virtualDOM.createElement(sortButtonId, 'button', 'grid-sort-button');
                
                const existingSort = this.state.sortModel.find(s => s.colId === col.field);
                if (existingSort) {
                    this.virtualDOM.updateElement(sortButtonId, {
                        attributes: {
                            'data-sort': existingSort.sort
                        }
                    });
                }

                this.virtualDOM.updateElement(sortButtonId, {
                    content: `<svg class="sort-icon" width="16" height="16" viewBox="0 0 16 16"><path class="sort-up" d="M8 4l4 4H4z"/><path class="sort-down" d="M8 12l4-4H4z"/></svg>`,
                    events: {
                        click: (e: MouseEvent) => {
                            e.stopPropagation();
                            this.handleSortClick(e, col);
                        }
                    }
                });
                
                this.virtualDOM.appendChild(actionContainerId, sortButtonId);
            }

            if (col.filterable) {
                const filterButtonId = `${this.instanceId}-filter-button-${col.field}`;
                this.virtualDOM.createElement(filterButtonId, 'button', 'grid-filter-button');
                
                const hasFilter = this.state.filterModel.has(col.field);
                if (hasFilter) {
                    this.virtualDOM.updateElement(filterButtonId, {
                        classes: ['active']
                    });
                }

                this.virtualDOM.updateElement(filterButtonId, {
                    content: `<svg class="filter-icon" width="16" height="16" viewBox="0 0 16 16"><path d="M2 2h12l-5 6v6l-2-2V8z"/></svg>`,
                    events: {
                        click: (e: MouseEvent) => {
                            e.stopPropagation();
                            this.showFilterMenu(e, col);
                        }
                    }
                });
                
                this.virtualDOM.appendChild(actionContainerId, filterButtonId);
            }

            this.virtualDOM.appendChild(titleContainerId, titleId);
            this.virtualDOM.appendChild(titleContainerId, actionContainerId);
            this.virtualDOM.appendChild(cellId, titleContainerId);

            if (col.resizable !== false) {
                const resizerId = `${this.instanceId}-resizer-${col.field}`;
                this.virtualDOM.createElement(resizerId, 'div', 'column-resizer');
                
                this.virtualDOM.updateElement(resizerId, {
                    events: {
                        mousedown: (e: MouseEvent) => {
                            const cellElement = this.virtualDOM.getElement(cellId);
                            if (cellElement) {
                                this.handleResizeStart(e, col, cellElement);
                            }
                        }
                    }
                });
                
                this.virtualDOM.appendChild(cellId, resizerId);
            }

            this.virtualDOM.appendChild(headerId, cellId);
        });

        this.virtualDOM.appendChild(headerWrapperId, headerId);
        
        const headerWrapperElement = this.virtualDOM.getElement(headerWrapperId);
        if (headerWrapperElement) {
            this.scrollSyncManager.addScrollable('header', headerWrapperElement, {
                syncHorizontal: true,
                syncVertical: false
            });
        }

        return headerWrapperElement;
    }

    private renderBody() {
        const bodyId = `${this.instanceId}-body`;
        this.virtualDOM.createElement(bodyId, 'div', 'grid-body');

        const contentId = `${this.instanceId}-content`;
        this.virtualDOM.createElement(contentId, 'div', 'grid-content');
        this.virtualDOM.updateElement(contentId, { styles: { minWidth: 'fit-content' } });

        const displayedData = this.getFilteredAndSortedData();
        const currentVRowIds = new Set<string>();
        
        // 保存行合并信息，用于跳过被合并的单元格
        const skipCells: Map<string, boolean> = new Map();

        displayedData.forEach((row, rowIndex) => {
            const rowId = row.id?.toString() || rowIndex.toString();
            const vRowId = `${this.instanceId}-row-${rowId}`;
            currentVRowIds.add(vRowId);

            this.virtualDOM.createElement(vRowId, 'div', 'grid-row');
            const rowHeight = this.options.rowHeight || 40;
            this.virtualDOM.updateElement(vRowId, {
                attributes: { 'data-row-id': rowId },
                styles: {
                    height: `${rowHeight}px`,
                    position: 'absolute',
                    top: `${rowIndex * rowHeight}px`,
                    left: '0',
                    right: '0'
                },
                events: {
                    click: (e: MouseEvent) => this.handleRowClick(e, row, rowIndex),
                    dblclick: (e: MouseEvent) => this.handleRowDoubleClick(e, row, rowIndex)
                }
            });

            // 获取当前行的节点
            const node = this.rowNodes.get(rowId);
            
            this.options.columns.forEach((col, colIndex) => {
                // 检查这个单元格是否应该被跳过（被其他单元格合并）
                const cellKey = `${rowIndex}-${colIndex}`;
                if (skipCells.get(cellKey)) {
                    return; // 跳过这个单元格的渲染
                }
                
                const vCellId = `${this.instanceId}-cell-${rowId}-${col.field}`;
                const cellClasses = ['grid-cell'];
                if (col.editable) {
                    cellClasses.push('editable');
                }
                
                // 为树形单元格添加特殊类
                if (node && node.level !== undefined && node.level > 0 && col === this.options.columns[0]) {
                    cellClasses.push('grid-tree-cell');
                }
                
                this.virtualDOM.createElement(vCellId, 'div', cellClasses.join(' '));
                
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
                        api: this,
                        column: col,
                        colId: col.field,
                        refreshCell: () => {}
                    };
                    colSpan = col.colSpan(params) || 1;
                    
                    // 标记被合并的单元格，以便跳过它们
                    for (let i = 1; i < colSpan; i++) {
                        if (colIndex + i < this.options.columns.length) {
                            skipCells.set(`${rowIndex}-${colIndex + i}`, true);
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
                        api: this
                    };
                    rowSpan = this.options.rowSpan(params) || 1;
                    
                    // 标记被合并的单元格，以便跳过它们
                    for (let i = 1; i < rowSpan; i++) {
                        if (rowIndex + i < displayedData.length) {
                            skipCells.set(`${rowIndex + i}-${colIndex}`, true);
                        }
                    }
                }
                
                // 应用合并样式
                const cellStyles: Record<string, string> = { width: `${col.width}px` };
                if (colSpan > 1) {
                    let totalWidth = col.width;
                    for (let i = 1; i < colSpan; i++) {
                        if (colIndex + i < this.options.columns.length) {
                            totalWidth += this.options.columns[colIndex + i].width;
                        }
                    }
                    cellStyles.width = `${totalWidth}px`;
                    cellStyles.zIndex = '1';
                    cellStyles.position = 'relative';
                    cellStyles.overflow = 'hidden';
                }
                
                if (rowSpan > 1) {
                    cellStyles.height = `${rowSpan * (this.options.rowHeight || 40)}px`;
                    cellStyles.zIndex = '1';
                    cellStyles.position = 'relative';
                    cellStyles.overflow = 'hidden';
                }
                
                this.virtualDOM.updateElement(vCellId, {
                    attributes: { 
                        'data-field': col.field,
                        'data-element-id': vCellId,
                        'colspan': colSpan > 1 ? colSpan.toString() : '1',
                        'rowspan': rowSpan > 1 ? rowSpan.toString() : '1'
                    },
                    styles: cellStyles,
                    events: {
                        click: (e: MouseEvent) => {
                            this.handleCellClick(e, col, row, value, rowIndex);
                            if (col.editable) {
                                this.startEditing(e.currentTarget as HTMLElement, col, row, value);
                            }
                        },
                        dblclick: (e: MouseEvent) => {
                            this.handleCellDoubleClick(e, col, row, value, rowIndex);
                            if (col.editable) {
                                this.startEditing(e.currentTarget as HTMLElement, col, row, value);
                            }
                        }
                    }
                });
                
                // 渲染单元格
                const cellElement = this.virtualDOM.getElement(vCellId) as HTMLElement;
                
                // 对于第一列且是树形结构的行，使用树形渲染器
                if (node && node.level !== undefined && col === this.options.columns[0] && !col.checkboxSelection && !col.rowDrag) {
                    // 清空单元格内容，避免重复添加树形结构
                    cellElement.innerHTML = '';
                    
                    // 创建树形单元格渲染器
                    const treeCellRenderer = new TreeCellRenderer();
                    treeCellRenderer.init({
                        value,
                        data: row,
                        rowIndex,
                        colId: col.field,
                        column: col,
                        api: this,
                        node
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
            const contentElement = this.virtualDOM.getElement(contentId);
            if (contentElement) {
                this.scrollSyncManager.addScrollable('content', contentElement, {
                    syncHorizontal: true,
                    syncVertical: true,
                    master: true
                });
            }
        }
        return bodyElement;
    }

    private renderCell(cell: HTMLElement, column: Column, row: any, value: any, rowIndex: number) {
        const cellId = cell.getAttribute('data-element-id');
        if (!cellId) return;
        
        // 处理复选框列
        if (column.checkboxSelection) {
            const checkboxContainerId = `${cellId}-checkbox-container`;
            this.virtualDOM.createElement(checkboxContainerId, 'div', 'grid-cell-checkbox-container');
            this.virtualDOM.updateElement(checkboxContainerId, {
                styles: {
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    width: '100%'
                }
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
                api: this,
                node
            });
            
            const checkboxElement = checkboxRenderer.getGui();
            
            // 将复选框元素添加到容器
            const checkboxContainer = this.virtualDOM.getElement(checkboxContainerId);
            if (checkboxContainer) {
                checkboxContainer.innerHTML = '';
                checkboxContainer.appendChild(checkboxElement);
            }
            
            this.virtualDOM.appendChild(cellId, checkboxContainerId);
            return;
        }
        
        // 处理行拖拽列
        if (column.rowDrag) {
            const dragContainerId = `${cellId}-drag-container`;
            this.virtualDOM.createElement(dragContainerId, 'div', 'grid-cell-drag-container');
            this.virtualDOM.updateElement(dragContainerId, {
                styles: {
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    width: '100%'
                }
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
                api: this,
                node
            });
            
            const dragElement = dragRenderer.getGui();
            
            // 将拖拽元素添加到容器
            const dragContainer = this.virtualDOM.getElement(dragContainerId);
            if (dragContainer) {
                dragContainer.innerHTML = '';
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
            this.virtualDOM.createElement(contentId, 'div', 'grid-cell-content');
            this.virtualDOM.updateElement(contentId, {
                styles: {
                    position: 'relative',
                    width: '100%',
                    height: '100%',
                    boxSizing: 'border-box',
                    overflow: 'hidden'
                }
            });
            
            // 添加拖拽手柄
            const dragHandleId = `${contentId}-draghandle`;
            this.virtualDOM.createElement(dragHandleId, 'div', 'grid-cell-drag-handle');
            this.virtualDOM.updateElement(dragHandleId, {
                styles: {
                    position: 'absolute',
                    right: '0',
                    bottom: '0',
                    width: '6px',
                    height: '6px',
                    zIndex: '2'
                }
            });
            this.virtualDOM.appendChild(contentId, dragHandleId);
            
            // 获取创建后的元素
            contentElement = this.virtualDOM.getElement(contentId);
        }
        
        // 创建视图容器ID
        const viewContainerId = `${contentId}-view`;
        
        // 如果单元格处于编辑状态，隐藏视图组件但不销毁它
        if (cell.classList.contains('editing')) {
            const viewContainer = this.virtualDOM.getElement(viewContainerId);
            if (viewContainer) {
                viewContainer.style.display = 'none';
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
            api: this,
            node
        };
        
        // 创建视图组件
        const viewComponentId = `${cellId}-view`;
        const viewElement = this.componentManager.createViewComponent(viewComponentId, column, params);
        
        // 创建或获取视图容器
        let viewContainer = this.virtualDOM.getElement(viewContainerId);
        if (!viewContainer) {
            // 如果视图容器不存在，创建它
            this.virtualDOM.createElement(viewContainerId, 'div', 'grid-cell-view-container');
            this.virtualDOM.appendChild(contentId, viewContainerId);
            viewContainer = this.virtualDOM.getElement(viewContainerId);
        }
        
        // 更新视图容器内容
        if (viewContainer) {
            // 确保视图容器可见
            viewContainer.style.display = 'flex';
            
            // 清空并添加视图元素
            viewContainer.innerHTML = '';
            viewContainer.appendChild(viewElement);
        }
        
        // 确保编辑容器隐藏
        const editContainerId = `${contentId}-edit`;
        const editContainer = this.virtualDOM.getElement(editContainerId);
        if (editContainer) {
            editContainer.style.display = 'none';
        }
        
        // 附加内容到单元格
        this.virtualDOM.appendChild(cellId, contentId);
    }

    private handleSortClick(e: MouseEvent, column: Column) {
        if (!column.sortable) return;

        const headerCell = (e.target as HTMLElement).closest('.grid-header-cell');
        if (!headerCell) return;

        const existingSort = this.state.sortModel.find(s => s.colId === column.field);
        
        // 更新排序状态
        if (!existingSort) {
            this.state.sortModel = [{ colId: column.field, sort: 'asc' }];
            headerCell.setAttribute('data-sort', 'asc');
        } else if (existingSort.sort === 'asc') {
            this.state.sortModel = [{ colId: column.field, sort: 'desc' }];
            headerCell.setAttribute('data-sort', 'desc');
        } else {
            this.state.sortModel = [];
            headerCell.removeAttribute('data-sort');
        }

        // 清除其他列的排序状态
        const otherHeaders = this.element.querySelectorAll(`.grid-header-cell:not([data-field="${column.field}"])`);
        otherHeaders.forEach(header => header.removeAttribute('data-sort'));

        // 触发排序变更事件
        if (this.options.onSortChanged) {
            this.options.onSortChanged({ sortModel: this.state.sortModel, api: this });
        }

        this.refreshView();
    }

    private initializeDragAndDropListeners() {
        this.element.addEventListener('dragstart', this.handleDragStart.bind(this));
        this.element.addEventListener('dragover', this.handleDragOver.bind(this));
        this.element.addEventListener('drop', this.handleDrop.bind(this));
        this.element.addEventListener('dragend', this.handleDragEnd.bind(this));
    }

    private handleDragStart(e: DragEvent) {
        const element = (e.target as HTMLElement).closest('.grid-header-cell');
        if (!element || !e.dataTransfer || !(e.target as HTMLElement).draggable) {
            return;
        }

        const field = (element as HTMLElement).dataset.field;
        if (!field) return;

        const column = this.options.columns.find(c => c.field === field);
        if (!column) return;

        this.state.dragState.draggedColumn = column;
        this.state.dragState.draggedElement = element as HTMLElement;

        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', column.field);

        element.classList.add('dragging');
    }

    private handleDragOver(e: DragEvent) {
        const element = (e.target as HTMLElement).closest('.grid-header-cell');
        if (!element) return;

        e.preventDefault();
        if (e.dataTransfer) {
            e.dataTransfer.dropEffect = 'move';
        }
    }

    private handleDrop(e: DragEvent) {
        e.preventDefault();
        const targetElement = (e.target as HTMLElement).closest('.grid-header-cell');
        if (!targetElement) return;

        const field = (targetElement as HTMLElement).dataset.field;
        if (!field) return;

        const targetColumn = this.options.columns.find(c => c.field === field);
        const { draggedColumn } = this.state.dragState;

        if (!draggedColumn || !targetColumn || draggedColumn === targetColumn) return;

        const sourceIndex = this.options.columns.indexOf(draggedColumn);
        const targetIndex = this.options.columns.indexOf(targetColumn);

        if (sourceIndex === -1 || targetIndex === -1) return;

        const columns = [...this.options.columns];
        columns.splice(sourceIndex, 1);
        columns.splice(targetIndex, 0, draggedColumn);

        this.options.columns = columns;

        this.refreshView();
    }

    private handleDragEnd() {
        const { draggedElement } = this.state.dragState;
        if (draggedElement) {
            draggedElement.classList.remove('dragging');
        }
        this.state.dragState.draggedColumn = null;
        this.state.dragState.draggedElement = null;
    }

    private handleResizeStart(e: MouseEvent, column: Column, element: HTMLElement) {
        e.preventDefault();
        this.state.dragState.resizeStartX = e.clientX;
        this.state.dragState.resizeColumn = column;
        this.state.dragState.resizeElement = element;
        document.body.style.cursor = 'col-resize';

        // 添加全局鼠标事件监听
        document.addEventListener('mousemove', this.handleResizeMove);
        document.addEventListener('mouseup', this.handleResizeEnd);
    }

    private handleResizeMove = (e: MouseEvent) => {
        if (!this.state.dragState.resizeColumn || !this.state.dragState.resizeElement) return;
        
        const diff = e.clientX - this.state.dragState.resizeStartX;
        const newWidth = Math.max(50, this.state.dragState.resizeColumn.width + diff);
        
        this.state.dragState.resizeColumn.width = newWidth;
        this.state.dragState.resizeElement.style.width = `${newWidth}px`;
        
        // 更新对应的数据单元格宽度
        const columnIndex = this.options.columns.indexOf(this.state.dragState.resizeColumn);
        const cells = this.element.querySelectorAll(`.grid-row .grid-cell:nth-child(${columnIndex + 1})`);
        cells.forEach(cell => (cell as HTMLElement).style.width = `${newWidth}px`);
        
        this.state.dragState.resizeStartX = e.clientX;
    }

    private handleResizeEnd = () => {
        this.state.dragState.resizeColumn = null;
        this.state.dragState.resizeElement = null;
        document.body.style.cursor = '';
        
        // 移除全局鼠标事件监听
        document.removeEventListener('mousemove', this.handleResizeMove);
        document.removeEventListener('mouseup', this.handleResizeEnd);
    }

    private startEditing(cell: HTMLElement, column: Column, row: any, value: any) {
        // 如果已经在编辑，不要重复操作
        if (cell.classList.contains('editing')) return;
        
        const cellId = cell.getAttribute('data-element-id');
        if (!cellId) return;
        
        // 获取contentId
        const contentId = `${cellId}-content`;
        
        // 保存原始值用于取消编辑
        this.originalEditValue = row[column.field];
        
        // 设置编辑状态
        cell.classList.add('editing');
        this.virtualDOM.updateElement(cellId, {
            classes: ['grid-cell', 'editable', 'editing']
        });
        
        // 隐藏视图组件
        const viewContainerId = `${contentId}-view`;
        const viewContainer = this.virtualDOM.getElement(viewContainerId);
        if (viewContainer) {
            viewContainer.style.display = 'none';
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
            api: this,
            node,
            onComplete: (newValue: any) => {
                document.removeEventListener('click', handleClickOutside);
                this.finishEditing(cell, column, row, newValue);
            },
            onCancel: () => {
                document.removeEventListener('click', handleClickOutside);
                this.cancelEditing(cell, column, row);
            },
            stopEditing: () => {
                document.removeEventListener('click', handleClickOutside);
                this.cancelEditing(cell, column, row);
            }
        };
        
        // 创建编辑组件
        const editComponentId = `${cellId}-edit`;
        const editComponent = this.componentManager.createEditComponent(editComponentId, column, params);
        
        // 创建或获取编辑容器
        const editContainerId = `${contentId}-edit`;
        let editContainer = this.virtualDOM.getElement(editContainerId);
        if (!editContainer) {
            this.virtualDOM.createElement(editContainerId, 'div', 'grid-cell-edit-container');
            this.virtualDOM.updateElement(editContainerId, {
                styles: {
                    overflow: 'hidden',
                    width: '100%',
                    height: '100%',
                    boxSizing: 'border-box'
                }
            });
            editContainer = this.virtualDOM.getElement(editContainerId);
            if (editContainer) {
                this.virtualDOM.appendChild(contentId, editContainerId);
            }
        }
        
        // 显示并更新编辑容器
        if (editContainer) {
            editContainer.style.display = 'flex';
            editContainer.innerHTML = '';
            
            // 处理特殊组件，确保它们不会溢出
            this.constrainEditComponent(editComponent, column);
            
            editContainer.appendChild(editComponent);
            
            // 尝试自动聚焦到输入元素
            setTimeout(() => {
                const input = editContainer.querySelector('input, select, textarea');
                if (input) {
                    (input as HTMLElement).focus();
                    if (input instanceof HTMLInputElement) {
                        input.select();
                    }
                }
            }, 0);
        }
        
        // 添加点击外部监听器
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            // 如果点击的不是当前编辑的单元格或其子元素，则退出编辑模式
            if (!cell.contains(target)) {
                document.removeEventListener('click', handleClickOutside);
                // 直接调用onComplete，让编辑组件自己处理值的获取和提交
                const input = editComponent.querySelector('input, select, textarea') as HTMLInputElement;
                if (input) {
                    params.onComplete!(input.value);
                } else {
                    // 如果找不到标准输入元素，取消编辑
                    this.cancelEditing(cell, column, row);
                }
            }
        };
        
        // 延迟添加事件监听器，避免触发当前的点击事件
        setTimeout(() => {
            document.addEventListener('click', handleClickOutside);
        }, 0);
    }
    
    // 约束编辑组件，确保它不会溢出容器
    private constrainEditComponent(component: HTMLElement, column: Column): void {
        // 对下拉菜单进行特殊处理
        const select = component.querySelector('select') as HTMLSelectElement;
        if (select) {
            select.style.width = '100%';
            select.style.maxWidth = '100%';
            select.style.overflow = 'hidden';
            select.style.textOverflow = 'ellipsis';
        }
        
        // 对输入框进行处理
        const input = component.querySelector('input') as HTMLInputElement;
        if (input) {
            input.style.width = '100%';
            input.style.maxWidth = '100%';
            input.style.boxSizing = 'border-box';
        }
        
        // 对其他自定义组件进行处理
        const customElements = component.querySelectorAll('div');
        customElements.forEach(el => {
            el.style.maxWidth = '100%';
            el.style.overflow = 'hidden';
            el.style.textOverflow = 'ellipsis';
        });
    }

    private finishEditing(cell: HTMLElement, column: Column, row: any, newValue: any) {
        // 如果已经不在编辑状态，直接返回
        if (!cell.classList.contains('editing')) return;
        
        const cellId = cell.getAttribute('data-element-id');
        if (!cellId) return;
        
        // 更新数据
        const oldValue = row[column.field];
        row[column.field] = newValue;
        
        // 移除编辑状态
        cell.classList.remove('editing');
        this.virtualDOM.updateElement(cellId, {
            classes: ['grid-cell', 'editable']
        });
        
        // 获取视图和编辑容器
        const contentId = `${cellId}-content`;
        const viewContainerId = `${contentId}-view`;
        const editContainerId = `${contentId}-edit`;
        const editComponentId = `${cellId}-edit`;
        
        // 隐藏编辑容器
        const editContainer = this.virtualDOM.getElement(editContainerId);
        if (editContainer) {
            editContainer.style.display = 'none';
        }
        
        // 销毁编辑组件
        this.componentManager.destroyComponent(editComponentId);
        
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
                    oldValue,
                    newValue,
                    event: new MouseEvent('click')
                });
            }
        }
    }

    private cancelEditing(cell: HTMLElement, column: Column, row: any) {
        if (!cell.classList.contains('editing')) return;
        
        const cellId = cell.getAttribute('data-element-id');
        if (!cellId) return;
        
        // 移除编辑状态
        cell.classList.remove('editing');
        this.virtualDOM.updateElement(cellId, {
            classes: ['grid-cell', 'editable']
        });
        
        // 获取视图和编辑容器
        const contentId = `${cellId}-content`;
        const viewContainerId = `${contentId}-view`;
        const editContainerId = `${contentId}-edit`;
        const editComponentId = `${cellId}-edit`;
        
        // 隐藏编辑容器
        const editContainer = this.virtualDOM.getElement(editContainerId);
        if (editContainer) {
            editContainer.style.display = 'none';
        }
        
        // 销毁编辑组件
        this.componentManager.destroyComponent(editComponentId);
        
        // 重新渲染视图组件（使用原始值）
        this.renderCell(cell, column, row, row[column.field], row.rowIndex);
    }

    private handleRowClick(e: MouseEvent, row: any, rowIndex: number) {
        if (this.options.onRowClicked) {
            const node = this.rowNodes.get(row.id || rowIndex);
            if (node) {
                this.options.onRowClicked({
                    node,
                    data: row,
                    event: e
                });
            }
        }
    }

    private handleRowDoubleClick(e: MouseEvent, row: any, rowIndex: number) {
        if (this.options.onRowDoubleClicked) {
            const node = this.rowNodes.get(row.id || rowIndex);
            if (node) {
                this.options.onRowDoubleClicked({
                    node,
                    data: row,
                    event: e
                });
            }
        }
    }

    private handleCellClick(e: MouseEvent, column: Column, row: any, value: any, rowIndex: number) {
        if (this.options.onCellClicked) {
            const node = this.rowNodes.get(row.id || rowIndex);
            if (node) {
                this.options.onCellClicked({
                    node,
                    data: row,
                    column,
                    colId: column.field,
                    value,
                    event: e
                });
            }
        }
    }

    private handleCellDoubleClick(e: MouseEvent, column: Column, row: any, value: any, rowIndex: number) {
        if (this.options.onCellDoubleClicked) {
            const node = this.rowNodes.get(row.id || rowIndex);
            if (node) {
                this.options.onCellDoubleClicked({
                    node,
                    data: row,
                    column,
                    colId: column.field,
                    value,
                    event: e
                });
            }
        }
    }

    private getFilteredAndSortedData(): any[] {
        // 获取所有行节点
        const allNodes: RowNode[] = [];
        this.rowNodes.forEach(node => {
            allNodes.push(node);
        });
        
        // 首先按照行索引排序，确保树形结构的正确顺序
        allNodes.sort((a, b) => a.rowIndex - b.rowIndex);
        
        // 过滤出可见的节点（考虑父子结构）
        const visibleNodes = this.getVisibleNodes(allNodes);
        
        // 应用过滤
        let filteredNodes = visibleNodes;
        if (this.state.filterModel.size > 0) {
            filteredNodes = visibleNodes.filter(node => {
                return Array.from(this.state.filterModel.entries()).every(([columnId, model]) => {
                    const value = node.data[columnId];
                    
                    // 实现默认过滤逻辑
                    if (model.filter && value !== undefined) {
                        const filterValue = model.filter.toString().toLowerCase();
                        const cellValue = value.toString().toLowerCase();
                        
                        switch (model.type) {
                            case 'equals':
                                return cellValue === filterValue;
                            case 'notEqual':
                                return cellValue !== filterValue;
                            case 'contains':
                                return cellValue.includes(filterValue);
                            case 'notContains':
                                return !cellValue.includes(filterValue);
                            case 'startsWith':
                                return cellValue.startsWith(filterValue);
                            case 'endsWith':
                                return cellValue.endsWith(filterValue);
                            default:
                                return true;
                        }
                    }
                    return true;
                });
            });
        }
        
        // 应用排序（如果不是树形数据）
        if (this.state.sortModel.length > 0 && !this.hasTreeData()) {
            filteredNodes.sort((a, b) => {
                for (const sort of this.state.sortModel) {
                    const column = this.options.columns.find(col => col.field === sort.colId);
                    const valueA = a.data[sort.colId];
                    const valueB = b.data[sort.colId];
                    
                    if (column?.comparator) {
                        const result = column.comparator(valueA, valueB, a, b);
                        if (result !== 0) return sort.sort === 'asc' ? result : -result;
                    } else {
                        if (valueA < valueB) return sort.sort === 'asc' ? -1 : 1;
                        if (valueA > valueB) return sort.sort === 'asc' ? 1 : -1;
                    }
                }
                return 0;
            });
        }
        
        // 返回数据对象
        return filteredNodes.map(node => node.data);
    }
    
    private getVisibleNodes(allNodes: RowNode[]): RowNode[] {
        const visibleNodes: RowNode[] = [];
        
        // 如果没有树形数据，直接返回所有节点
        if (!this.hasTreeData()) {
            return allNodes;
        }
        
        // 获取根节点（没有父节点的节点）
        const rootNodes = allNodes.filter(node => !node.parent);
        
        // 递归添加可见节点
        for (const rootNode of rootNodes) {
            this.addVisibleNode(rootNode, visibleNodes);
        }
        
        return visibleNodes;
    }
    
    private addVisibleNode(node: RowNode, visibleNodes: RowNode[]): void {
        // 添加当前节点
        visibleNodes.push(node);
        
        // 如果节点展开且有子节点，递归添加子节点
        if (node.expanded && node.children && node.children.length > 0) {
            // 查找子节点
            const childNodes: RowNode[] = [];
            this.rowNodes.forEach(possibleChild => {
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
    
    private hasTreeData(): boolean {
        let hasTree = false;
        this.rowNodes.forEach(node => {
            if (node.level && node.level > 0) {
                hasTree = true;
            }
        });
        return hasTree;
    }

    render(container: HTMLElement) {
        // 清空容器
        this.element.innerHTML = '';
        
        const headerElement = this.renderHeader();
        const bodyElement = this.renderBody();

        if (headerElement) {
            this.element.appendChild(headerElement);
        }
        if (bodyElement) {
            this.element.appendChild(bodyElement);
        }

        // 清空并添加到容器
        container.innerHTML = '';
        container.appendChild(this.element);
    }

    // GridApi implementation
    setRowData(data: any[]): void {
        this.options.rowData = data;
        this.initRowNodes();
        this.refreshView();
    }

    getRowNode(id: string | number): RowNode | undefined {
        return this.rowNodes.get(id);
    }

    getDisplayedRowAtIndex(index: number): RowNode | undefined {
        const data = this.getFilteredAndSortedData()[index];
        return data ? this.rowNodes.get(data.id) : undefined;
    }

    getDisplayedRowCount(): number {
        return this.getFilteredAndSortedData().length;
    }

    forEachNode(callback: (node: RowNode, index: number) => void): void {
        let index = 0;
        this.rowNodes.forEach(node => {
            callback(node, index);
            index++;
        });
    }

    selectAll(): void {
        this.rowNodes.forEach(node => {
            node.selected = true;
            this.state.selectedNodes.add(node.id);
        });
        this.refreshView();
    }

    deselectAll(): void {
        this.state.selectedNodes.clear();
        this.rowNodes.forEach(node => node.selected = false);
        this.refreshView();
    }

    selectRow(id: string | number, clearOthers = true): void {
        if (clearOthers) {
            this.deselectAll();
        }
        const node = this.rowNodes.get(id);
        if (node) {
            node.selected = true;
            this.state.selectedNodes.add(id);
            this.refreshView();
        }
    }

    getSelectedNodes(): RowNode[] {
        return Array.from(this.state.selectedNodes).map(id => this.rowNodes.get(id)!);
    }

    getSelectedRows(): any[] {
        return this.getSelectedNodes().map(node => node.data);
    }

    setSort(sortModel: SortModel[]): void {
        this.state.sortModel = sortModel;
        this.refreshView();
    }

    setFilter(columnId: string, filterModel: FilterModel): void {
        this.state.filterModel.set(columnId, filterModel);
        this.refreshView();
    }

    setColumnDefs(colDefs: Column[]): void {
        this.options.columns = colDefs;
        this.refreshView();
    }

    sizeColumnsToFit(): void {
        if (!this.element) return;
        
        const totalWidth = this.element.clientWidth;
        const columnCount = this.options.columns.length;
        const width = Math.floor(totalWidth / columnCount);
        
        this.options.columns.forEach(col => {
            col.width = width;
        });
        
        this.refreshView();
    }

    autoSizeColumns(): void {
        // 这里可以实现自动调整列宽的逻辑
        // 可以根据内容计算最大宽度
    }

    refreshView(): void {
        if (this.element && this.element.parentElement) {
            // 保存当前滚动位置
            this.saveScrollPosition();

            // 在重新渲染前清空缓存，防止状态不一致

            // 重新渲染整个表格内容，确保 header 和 body 的一致性
            this.element.innerHTML = '';
            const headerElement = this.renderHeader();
            const bodyElement = this.renderBody();

            if (headerElement) {
                this.element.appendChild(headerElement);
            }
            if (bodyElement) {
                this.element.appendChild(bodyElement);
            }
            
            // 恢复滚动位置
            this.restoreScrollPosition();
        }
    }

    ensureIndexVisible(index: number, position: 'top' | 'middle' | 'bottom' = 'middle'): void {
        const rowHeight = this.options.rowHeight || 40;
        const gridBody = this.element.querySelector('.grid-body') as HTMLElement;
        if (!gridBody) return;

        const bodyHeight = gridBody.clientHeight;
        let scrollTop;

        switch (position) {
            case 'top':
                scrollTop = index * rowHeight;
                break;
            case 'bottom':
                scrollTop = (index * rowHeight) - bodyHeight + rowHeight;
                break;
            case 'middle':
            default:
                scrollTop = (index * rowHeight) - (bodyHeight / 2) + (rowHeight / 2);
        }

        this.scrollSyncManager.scrollTo(this.state.scrollPosition.left, Math.max(0, scrollTop));
    }

    ensureNodeVisible(node: RowNode, position?: 'top' | 'middle' | 'bottom'): void {
        const data = this.getFilteredAndSortedData();
        const index = data.findIndex(row => row.id === node.id);
        if (index !== -1) {
            this.ensureIndexVisible(index, position);
        }
    }

    private showFilterMenu(e: MouseEvent, column: Column) {
        const button = e.currentTarget as HTMLElement;
        const buttonRect = button.getBoundingClientRect();
        const headerRect = this.element.getBoundingClientRect();
        
        // 创建筛选菜单
        const menu = document.createElement('div');
        menu.className = 'grid-filter-menu';
        
        // 如果有自定义筛选组件
        if (column.filterParams?.filterComponent) {
            const filterModel = this.state.filterModel.get(column.field) || {
                type: 'equals',
                filterType: 'text'
            };
            
            const component = column.filterParams.filterComponent({
                column,
                api: this,
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
                        this.options.rowData.forEach(row => {
                            const value = row[column.field];
                            if (value !== undefined && value !== null) {
                                values.add(value);
                            }
                        });
                    }
                    return Array.from(values);
                }
            });
            
            menu.appendChild(component);
        } else {
            // 默认筛选菜单
            this.createDefaultFilterMenu(menu, column);
        }
        
        // 定位菜单 - 相对于按钮定位
        menu.style.position = 'absolute';
        menu.style.top = `${buttonRect.bottom - headerRect.top}px`;
        // 水平居中对齐按钮
        menu.style.left = `${buttonRect.left - headerRect.left - (200 - buttonRect.width) / 2}px`;
        
        // 添加点击外部关闭
        const closeMenu = (e: MouseEvent) => {
            if (!menu.contains(e.target as Node)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };
        
        // 延迟添加事件监听，避免立即触发
        setTimeout(() => {
            document.addEventListener('click', closeMenu);
        });
        
        this.element.appendChild(menu);
    }

    private createDefaultFilterMenu(menu: HTMLElement, column: Column) {
        const filterModel = this.state.filterModel.get(column.field) || {
            type: 'equals',
            filterType: 'text'
        };
        
        // 筛选类型选择
        const typeSelect = document.createElement('select');
        typeSelect.className = 'grid-filter-type-select';
        
        const types = [
            { value: 'equals', label: '等于' },
            { value: 'notEqual', label: '不等于' },
            { value: 'contains', label: '包含' },
            { value: 'notContains', label: '不包含' },
            { value: 'startsWith', label: '开头是' },
            { value: 'endsWith', label: '结尾是' }
        ];
        
        types.forEach(type => {
            const option = document.createElement('option');
            option.value = type.value;
            option.textContent = type.label;
            if (type.value === filterModel.type) {
                option.selected = true;
            }
            typeSelect.appendChild(option);
        });
        
        // 筛选值输入
        const input = document.createElement('input');
        input.className = 'grid-filter-input';
        input.type = 'text';
        input.value = filterModel.filter as string || '';
        
        // 按钮容器
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'grid-filter-buttons';
        
        // 确定按钮
        const applyButton = document.createElement('button');
        applyButton.textContent = '确定';
        applyButton.addEventListener('click', () => {
            const value = input.value.trim();
            if (value) {
                this.state.filterModel.set(column.field, {
                    type: typeSelect.value as FilterModel['type'],
                    filter: value,
                    filterType: 'text'
                });
            } else {
                this.state.filterModel.delete(column.field);
            }
            this.refreshView();
            menu.remove();
        });
        
        // 清除按钮
        const clearButton = document.createElement('button');
        clearButton.textContent = '清除';
        clearButton.addEventListener('click', () => {
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

    private initializeDragToFill() {
        let isDragging = false;
        let startCell: HTMLElement | null = null;
        let startNode: RowNode | null = null;
        let startColumn: Column | null = null;
        let startValue: any = null;

        // 添加拖拽事件监听
        this.element.addEventListener('mousedown', (e: MouseEvent) => {
            const handle = (e.target as HTMLElement).closest('.grid-cell-drag-handle');
            if (!handle) return;

            const cell = handle.closest('.grid-cell') as HTMLElement;
            const row = cell.closest('.grid-row') as HTMLElement;
            if (!cell || !row) return;

            e.preventDefault(); // 阻止默认行为
            e.stopPropagation();
            isDragging = true;
            startCell = cell;

            // 添加禁止选择文本的样式
            document.body.style.userSelect = 'none';
            (document.body.style as any).webkitUserSelect = 'none';

            const rowId = row.getAttribute('data-row-id');
            const field = cell.getAttribute('data-field');
            
            if (rowId && field) {
                const node = this.rowNodes.get(rowId);
                const column = this.options.columns.find(col => col.field === field);
                
                if (node && column) {
                    startNode = node;
                    startColumn = column;
                    startValue = node.data[field];
                }
            }

            document.body.style.cursor = 'crosshair';
            document.addEventListener('mousemove', handleDrag);
            document.addEventListener('mouseup', handleDragEnd);
        });

        const handleDrag = (e: MouseEvent) => {
            if (!isDragging || !startCell) return;

            e.preventDefault(); // 阻止默认行为
            const currentCell = (e.target as HTMLElement).closest('.grid-cell') as HTMLElement;
            if (currentCell) {
                this.highlightDragRange(startCell, currentCell);
            }
        };

        const handleDragEnd = (e: MouseEvent) => {
            if (!isDragging || !startCell || !startNode || !startColumn) return;

            e.preventDefault(); // 阻止默认行为

            // 恢复文本选择
            document.body.style.userSelect = '';
            (document.body.style as any).webkitUserSelect = '';

            const endCell = (e.target as HTMLElement).closest('.grid-cell') as HTMLElement;
            if (endCell) {
                const endRow = endCell.closest('.grid-row') as HTMLElement;
                if (endRow) {
                    const endRowId = endRow.getAttribute('data-row-id');
                    const endColField = endCell.getAttribute('data-field');

                    if (endRowId && endColField) {
                        const endNode = this.rowNodes.get(endRowId);
                        const endColumn = this.options.columns.find(col => col.field === endColField);

                        if (endNode && endColumn) {
                            this.setValues({
                                startNode,
                                startColumn,
                                endNode,
                                endColumn,
                                value: startValue,
                                valueGenerator: startColumn.valueSetParams?.valueGenerator
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
            document.body.style.cursor = '';
            this.clearDragHighlight();
            document.removeEventListener('mousemove', handleDrag);
            document.removeEventListener('mouseup', handleDragEnd);
        };
    }

    private highlightDragRange(startCell: HTMLElement, endCell: HTMLElement) {
        this.clearDragHighlight();
        
        // 获取所有需要高亮的单元格
        const startRowEl = startCell.closest('.grid-row');
        const endRowEl = endCell.closest('.grid-row');
        
        if (!startRowEl || !endRowEl) return;
        
        const startRowId = startRowEl.getAttribute('data-row-id');
        const endRowId = endRowEl.getAttribute('data-row-id');
        
        if (!startRowId || !endRowId) return;
        
        const startField = startCell.getAttribute('data-field');
        const endField = endCell.getAttribute('data-field');
        
        if (!startField || !endField) return;
        
        // 获取行和列的索引
        const startNode = this.rowNodes.get(startRowId);
        const endNode = this.rowNodes.get(endRowId);
        
        if (!startNode || !endNode) return;
        
        const startColIndex = this.options.columns.findIndex(col => col.field === startField);
        const endColIndex = this.options.columns.findIndex(col => col.field === endField);
        
        if (startColIndex === -1 || endColIndex === -1) return;
        
        // 计算范围
        const minRowIndex = Math.min(startNode.rowIndex, endNode.rowIndex);
        const maxRowIndex = Math.max(startNode.rowIndex, endNode.rowIndex);
        const minColIndex = Math.min(startColIndex, endColIndex);
        const maxColIndex = Math.max(startColIndex, endColIndex);
        
        // 获取所有行
        const rows = this.element.querySelectorAll('.grid-row');
        
        // 为范围内的每个单元格添加高亮类
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i] as HTMLElement;
            const rowId = row.getAttribute('data-row-id');
            if (!rowId) continue;
            
            const node = this.rowNodes.get(rowId);
            if (!node) continue;
            
            // 如果行在范围内
            if (node.rowIndex >= minRowIndex && node.rowIndex <= maxRowIndex) {
                const cells = row.querySelectorAll('.grid-cell');
                
                for (let j = 0; j < cells.length; j++) {
                    const cell = cells[j] as HTMLElement;
                    const field = cell.getAttribute('data-field');
                    if (!field) continue;
                    
                    const colIndex = this.options.columns.findIndex(col => col.field === field);
                    if (colIndex === -1) continue;
                    
                    // 如果单元格在范围内
                    if (colIndex >= minColIndex && colIndex <= maxColIndex) {
                        cell.classList.add('grid-cell-drag-selected');
                        
                        // 添加边框类，根据位置添加不同的边框样式
                        if (node.rowIndex === minRowIndex) {
                            cell.classList.add('grid-cell-drag-top');
                        }
                        if (node.rowIndex === maxRowIndex) {
                            cell.classList.add('grid-cell-drag-bottom');
                        }
                        if (colIndex === minColIndex) {
                            cell.classList.add('grid-cell-drag-left');
                        }
                        if (colIndex === maxColIndex) {
                            cell.classList.add('grid-cell-drag-right');
                        }
                    }
                }
            }
        }
    }

    private clearDragHighlight() {
        // 移除所有单元格的高亮类
        const selectedCells = this.element.querySelectorAll('.grid-cell-drag-selected');
        selectedCells.forEach(cell => {
            cell.classList.remove(
                'grid-cell-drag-selected',
                'grid-cell-drag-top',
                'grid-cell-drag-bottom',
                'grid-cell-drag-left',
                'grid-cell-drag-right'
            );
        });
    }

    // 实现 GridApi 的批量赋值方法
    setValues(params: ValueSetParams): void {
        const { startNode, startColumn, endNode, endColumn, value, valueGenerator } = params;

        this.saveScrollPosition();

        const startRowIndex = startNode.rowIndex;
        const endRowIndex = endNode.rowIndex;
        const startColIndex = this.options.columns.indexOf(startColumn);
        const endColIndex = this.options.columns.indexOf(endColumn);

        if (startRowIndex === -1 || endRowIndex === -1 || startColIndex === -1 || endColIndex === -1) {
            return;
        }

        const displayedData = this.getFilteredAndSortedData();

        for (let rowIndex = Math.min(startRowIndex, endRowIndex); rowIndex <= Math.max(startRowIndex, endRowIndex); rowIndex++) {
            const rowData = displayedData[rowIndex];
            if (!rowData) continue;

            const node = this.rowNodes.get(rowData.id || rowIndex);
            if (!node) continue;

            for (let colIndex = Math.min(startColIndex, endColIndex); colIndex <= Math.max(startColIndex, endColIndex); colIndex++) {
                const column = this.options.columns[colIndex];
                if (!column) continue;

                const oldValue = node.data[column.field];
                const finalValue = valueGenerator
                    ? valueGenerator({
                        rowIndex,
                        colId: column.field,
                        originalValue: oldValue,
                        startValue: value,
                    })
                    : value;

                // Update the data model. `node.data` is a reference to the object in `options.rowData`.
                node.data[column.field] = finalValue;

                if (this.options.onCellValueChanged) {
                    this.options.onCellValueChanged({
                        node,
                        data: rowData,
                        column,
                        colId: column.field,
                        value: finalValue,
                        oldValue: oldValue,
                        newValue: finalValue,
                        event: new MouseEvent('click'), // Consider a more appropriate event
                    });
                }
            }
        }

        this.refreshView();
        this.restoreScrollPosition();
    }

    // 实现新增行操作API
    addRow(data: any, position: 'top' | 'bottom' = 'bottom'): void {
        // 确保rowData是数组
        if (!Array.isArray(this.options.rowData)) {
            this.options.rowData = [];
        }

        // 生成唯一ID
        if (data.id === undefined) {
            data.id = Date.now() + Math.floor(Math.random() * 1000);
        }

        // 根据位置添加数据
        if (position === 'top') {
            this.options.rowData.unshift(data);
        } else {
            this.options.rowData.push(data);
        }

        // 重新初始化行节点
        this.initRowNodes();
        this.refreshView();
    }

    removeRow(id: string | number): void {
        if (!Array.isArray(this.options.rowData)) return;

        const index = this.options.rowData.findIndex(row => row.id === id);
        if (index !== -1) {
            this.options.rowData.splice(index, 1);
            this.rowNodes.delete(id);
            this.initRowNodes();
            this.refreshView();
        }
    }

    moveRow(fromIndex: number, toIndex: number): void {
        if (!Array.isArray(this.options.rowData) || 
            fromIndex < 0 || 
            fromIndex >= this.options.rowData.length || 
            toIndex < 0 || 
            toIndex >= this.options.rowData.length) {
            return;
        }

        // 保存当前滚动位置
        this.saveScrollPosition();

        // 移动数据行
        const row = this.options.rowData.splice(fromIndex, 1)[0];
        this.options.rowData.splice(toIndex, 0, row);

        // 重新初始化行节点
        this.initRowNodes();

        // 触发行拖拽结束事件
        if (this.options.onRowDragEnd) {
            const node = this.rowNodes.get(row.id);
            if (node) {
                this.options.onRowDragEnd({
                    node,
                    data: row,
                    fromIndex,
                    toIndex,
                    event: new MouseEvent('dragend')
                });
            }
        }

        this.refreshView();
        this.restoreScrollPosition();
    }

    // 实现缺失的 GridApi 方法
    getFilterModel(): { [key: string]: FilterModel } {
        const model: { [key: string]: FilterModel } = {};
        this.state.filterModel.forEach((value, key) => {
            model[key] = value;
        });
        return model;
    }

    setFilterModel(model: { [key: string]: FilterModel }): void {
        this.state.filterModel.clear();
        Object.entries(model).forEach(([key, value]) => {
            this.state.filterModel.set(key, value);
        });
        this.refreshView();
    }

    clearFilters(): void {
        this.state.filterModel.clear();
        this.refreshView();
    }

    private saveScrollPosition() {
        const gridContent = this.element.querySelector('.grid-content') as HTMLElement;
        if (gridContent) {
            this.lastScrollTop = gridContent.scrollTop;
            this.lastScrollLeft = gridContent.scrollLeft;
        }
    }

    private restoreScrollPosition() {
        if (this.lastScrollTop > 0 || this.lastScrollLeft > 0) {
            requestAnimationFrame(() => {
                const gridContent = this.element.querySelector('.grid-content') as HTMLElement;
                if (gridContent) {
                    gridContent.scrollTop = this.lastScrollTop;
                    gridContent.scrollLeft = this.lastScrollLeft;
                }
            });
        }
    }

    public batchUpdateRows(updatedRows: Map<string | number, any>) {
        // This is a placeholder for the virtual DOM implementation.
        console.log('Batch updating rows via VirtualDOMManager', updatedRows);
        // TODO: Implement virtual DOM row updates
    }

    destroy() {
        this.scrollSyncManager.destroy();
        
        // 销毁所有组件
        this.componentManager.destroyAllComponents();
        
        if (this.virtualDOM) {
            this.virtualDOM.clear();
        }
        this.eventManager.clear();

        // 清理drag and drop监听器
        this.element.removeEventListener('dragstart', this.handleDragStart.bind(this));
        this.element.removeEventListener('dragover', this.handleDragOver.bind(this));
        this.element.removeEventListener('drop', this.handleDrop.bind(this));
        this.element.removeEventListener('dragend', this.handleDragEnd.bind(this));
    }

    private getCellEditValue(cell: HTMLElement): any {
        const cellId = cell.getAttribute('data-element-id');
        if (!cellId) return null;
        
        const contentId = `${cellId}-content`;
        const inputId = `${contentId}-input`;
        
        // 检查标准输入编辑器
        const inputElement = this.virtualDOM.getElement(inputId) as HTMLInputElement;
        if (inputElement) {
            // 确保数字类型输入返回有效数字，而不是NaN
            if (inputElement.type === 'number') {
                // 先检查值是否与原值不同，如果没变化则返回原值
                if (inputElement.value === this.originalEditValue?.toString()) {
                    return this.originalEditValue;
                }
                const numValue = inputElement.value.trim() === '' ? 0 : parseFloat(inputElement.value);
                return isNaN(numValue) ? 0 : numValue;
            }
            return inputElement.value;
        }
        
        // 检查自定义组件编辑器
        const componentContainerId = `${contentId}-component`;
        const componentContainer = this.virtualDOM.getElement(componentContainerId);
        if (componentContainer) {
            // 检查select元素
            const select = componentContainer.querySelector('select') as HTMLSelectElement;
            if (select) {
                // 关键修复：检查select是否真的改变了值
                if (!select.dataset.hasChanged && select.value === select.options[0].value) {
                    // 如果没有设置变更标记，且当前值是第一个选项，返回原始值
                    return this.originalEditValue;
                }
                return select.value;
            }
            
            // 检查输入元素
            const input = componentContainer.querySelector('input') as HTMLInputElement;
            if (input) {
                // 检查输入框是否真的被修改过
                if (input.type === 'number') {
                    // 先检查值是否与原值不同，如果没变化则返回原值
                    if (input.value === this.originalEditValue?.toString()) {
                        return this.originalEditValue;
                    }
                    const numValue = input.value.trim() === '' ? 0 : parseFloat(input.value);
                    return isNaN(numValue) ? 0 : numValue;  // 防止NaN值产生
                }
                return input.value;
            }
            
            // 如果没有找到输入元素，返回文本内容
            return componentContainer.textContent?.trim() || null;
        }
        
        return this.originalEditValue; // 默认返回原始值
    }
}