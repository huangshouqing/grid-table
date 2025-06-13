import {
    Column,
    GridOptions,
    RowNode,
    GridApi,
    SortModel,
    FilterModel,
    ValueSetParams
} from './types';
import { ScrollSyncManager } from './managers/ScrollSyncManager';
import { VirtualDOMManager } from './managers/VirtualDOMManager';
import { EventManager } from './managers/EventManager';
import { GridState } from './interface';
// 添加状态管理

export class Grid implements GridApi {
    private state: GridState;
    private virtualDOM: VirtualDOMManager;
    private eventManager: EventManager;
    private scrollSyncManager: ScrollSyncManager;
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
    }

    private handleScroll = (scrollLeft: number, scrollTop: number) => {
        this.state.scrollPosition = { top: scrollTop, left: scrollLeft };
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
            this.options.rowData.forEach((data, index) => {
                const node: RowNode = {
                    id: data.id || index,
                    data,
                    rowIndex: index,
                    selected: false
                };
                this.rowNodes.set(node.id, node);
            });
        }
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
                    'draggable': 'true'
                },
                styles: {
                    width: `${col.width}px`
                }
            });

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

            this.options.columns.forEach(col => {
                const vCellId = `${this.instanceId}-cell-${rowId}-${col.field}`;
                const cellClasses = ['grid-cell'];
                if (col.editable) {
                    cellClasses.push('editable');
                }
                this.virtualDOM.createElement(vCellId, 'div', cellClasses.join(' '));
                
                const value = row[col.field];
                const tempCell = document.createElement('div');
                this.renderCell(tempCell, col, row, value, rowIndex);

                this.virtualDOM.updateElement(vCellId, {
                    attributes: { 'data-field': col.field },
                    styles: { width: `${col.width}px` },
                    content: tempCell.innerHTML,
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
        const cellContent = document.createElement('div');
        cellContent.className = 'grid-cell-content';
        cellContent.style.position = 'relative';

        // 添加拖拽手柄到 cellContent 而不是 cell
        const dragHandle = document.createElement('div');
        dragHandle.className = 'grid-cell-drag-handle';
        cellContent.appendChild(dragHandle);

        if (column.cellRenderer) {
            // 处理自定义组件模式
            if (typeof column.cellRenderer === 'object') {
                const node = this.rowNodes.get(row.id || rowIndex);
                if (node) {
                    const componentContainer = document.createElement('div');
                    componentContainer.className = 'grid-cell-custom-component';
                    
                    // 渲染非编辑状态组件
                    if (column.cellRenderer.view) {
                        // 确保使用正确的值：优先使用传入的value，如果为undefined则使用row中的值
                        const displayValue = value !== undefined ? value : row[column.field];
                        const viewComponent = column.cellRenderer.view({
                            value: displayValue,
                            data: row,
                            rowIndex,
                            colId: column.field,
                            column,
                            api: this,
                            node
                        });
                        componentContainer.appendChild(viewComponent);
                    }
                    cellContent.appendChild(componentContainer);
                }
            } else {
                // 处理传统的渲染器函数
                const node = this.rowNodes.get(row.id || rowIndex);
                if (node) {
                    const displayValue = value !== undefined ? value : row[column.field];
                    const customElement = column.cellRenderer({
                        value: displayValue,
                        data: row,
                        rowIndex,
                        colId: column.field,
                        column,
                        api: this,
                        node
                    });
                    cellContent.appendChild(customElement);
                }
            }
        } else if (column.valueFormatter) {
            // 处理格式化文本
            const p = document.createElement('p');
            const displayValue = value !== undefined ? value : row[column.field];
            p.textContent = column.valueFormatter({
                value: displayValue,
                data: row,
                column
            });
            cellContent.appendChild(p);
        } else {
            // 处理纯文本
            const p = document.createElement('p');
            const displayValue = value !== undefined ? value : row[column.field];
            p.textContent = displayValue?.toString() ?? '';
            cellContent.appendChild(p);
        }

        // 清空单元格内容并添加新内容
        cell.innerHTML = '';
        cell.appendChild(cellContent);
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
        // 如果已经在编辑，不要重复创建
        if (cell.classList.contains('editing')) return;
        
        const cellContent = cell.querySelector('.grid-cell-content') as HTMLElement;
        if (!cellContent) return;
        
        // 保存原始值用于取消编辑 - 使用行数据中的实际值
        this.originalEditValue = row[column.field];
        
        // 保存原始内容用于取消编辑
        const originalContent = cellContent.innerHTML;
        cell.classList.add('editing');

        // 添加点击外部监听器
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            // 如果点击的不是当前编辑的单元格或其子元素，则退出编辑模式
            if (!cell.contains(target)) {
                document.removeEventListener('click', handleClickOutside);
                // 如果没有进行任何编辑，使用原始值
                const currentValue = this.getCellEditValue(cell);
                const finalValue = currentValue === null ? this.originalEditValue : currentValue;
                this.finishEditing(cell, column, row, finalValue);
            }
        };

        // 延迟添加事件监听器，避免触发当前的点击事件
        setTimeout(() => {
            document.addEventListener('click', handleClickOutside);
        }, 0);

        if (column.cellRenderer && typeof column.cellRenderer === 'object' && column.cellRenderer.edit) {
            // 使用自定义编辑器组件
            const componentContainer = document.createElement('div');
            componentContainer.className = 'grid-cell-custom-component';
            
            const node = this.rowNodes.get(row.id);
            if (node) {
                const editorComponent = column.cellRenderer.edit({
                    value: this.originalEditValue, // 使用行数据中的实际值
                    startValue: this.originalEditValue, // 使用行数据中的实际值
                    data: row,
                    rowIndex: node.rowIndex,
                    colId: column.field,
                    column,
                    api: this,
                    node,
                    onComplete: (newValue) => {
                        document.removeEventListener('click', handleClickOutside);
                        this.finishEditing(cell, column, row, newValue);
                    },
                    onCancel: () => {
                        document.removeEventListener('click', handleClickOutside);
                        cell.classList.remove('editing');
                        cellContent.innerHTML = originalContent;
                    }
                });
                
                // 清空内容并添加编辑器
                cellContent.innerHTML = '';
                componentContainer.appendChild(editorComponent);
                cellContent.appendChild(componentContainer);
            }
        } else {
            // 默认文本编辑模式
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'cell-editor';
            input.value = this.originalEditValue?.toString() ?? ''; // 使用行数据中的实际值
            
            // 清空内容并添加输入框
            cellContent.innerHTML = '';
            cellContent.appendChild(input);
            
            input.focus();
            input.select();
            
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    document.removeEventListener('click', handleClickOutside);
                    this.finishEditing(cell, column, row, input.value);
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    document.removeEventListener('click', handleClickOutside);
                    cell.classList.remove('editing');
                    cellContent.innerHTML = originalContent;
                }
            });
        }
    }

    private getCellEditValue(cell: HTMLElement): any {
        const input = cell.querySelector('input.cell-editor') as HTMLInputElement;
        if (input) {
            return input.value;
        }
        
        // 如果是自定义编辑器，可能需要特殊处理
        const customComponent = cell.querySelector('.grid-cell-custom-component');
        if (customComponent) {
            // 检查 select 元素
            const select = customComponent.querySelector('select') as HTMLSelectElement;
            if (select) {
                return select.value;
            }
            
            // 检查 input 元素
            const input = customComponent.querySelector('input') as HTMLInputElement;
            if (input) {
                return input.type === 'number' ? parseInt(input.value, 10) : input.value;
            }
            
            // 如果没有找到输入元素，返回原始内容
            const originalContent = customComponent.textContent;
            return originalContent || null;
        }
        
        return null;
    }

    private finishEditing(cell: HTMLElement, column: Column, row: any, newValue: any) {
        // 如果已经不在编辑状态，直接返回
        if (!cell.classList.contains('editing')) return;
        
        cell.classList.remove('editing');
        const oldValue = row[column.field];
        row[column.field] = newValue;
        
        // 重新渲染单元格
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
        let data = Array.isArray(this.options.rowData) ? [...this.options.rowData] : [];
        
        // 应用过滤
        if (this.state.filterModel.size > 0) {
            data = data.filter(row => {
                return Array.from(this.state.filterModel.entries()).every(([columnId, model]) => {
                    const value = row[columnId];
                    
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
        
        // 应用排序
        if (this.state.sortModel.length > 0) {
            data.sort((a, b) => {
                for (const sort of this.state.sortModel) {
                    const column = this.options.columns.find(col => col.field === sort.colId);
                    const valueA = a[sort.colId];
                    const valueB = b[sort.colId];
                    
                    if (column?.comparator) {
                        const nodeA = this.rowNodes.get(a.id)!;
                        const nodeB = this.rowNodes.get(b.id)!;
                        const result = column.comparator(valueA, valueB, nodeA, nodeB);
                        if (result !== 0) return sort.sort === 'asc' ? result : -result;
                    } else {
                        if (valueA < valueB) return sort.sort === 'asc' ? -1 : 1;
                        if (valueA > valueB) return sort.sort === 'asc' ? 1 : -1;
                    }
                }
                return 0;
            });
        }
        
        return data;
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
// ... (rest of the code remains the same)
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
        
        // 获取表格容器的位置信息
        const gridRect = this.element.getBoundingClientRect();
        const startRect = startCell.getBoundingClientRect();
        const endRect = endCell.getBoundingClientRect();
        
        const highlight = document.createElement('div');
        highlight.className = 'grid-drag-highlight';
        
        // 计算相对于表格容器的位置
        const top = Math.min(startRect.top, endRect.top) - gridRect.top;
        const left = Math.min(startRect.left, endRect.left) - gridRect.left;
        const width = Math.abs(endRect.left - startRect.left) + endRect.width;
        const height = Math.abs(endRect.top - startRect.top) + endRect.height;
        
        highlight.style.position = 'absolute';
        highlight.style.top = `${top}px`;
        highlight.style.left = `${left}px`;
        highlight.style.width = `${width}px`;
        highlight.style.height = `${height}px`;
        
        // 将高亮框添加到表格容器中，而不是 body
        this.element.appendChild(highlight);
    }

    private clearDragHighlight() {
        // 从表格容器中移除高亮框
        const highlight = this.element.querySelector('.grid-drag-highlight');
        if (highlight) {
            highlight.remove();
        }
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
        if (this.virtualDOM) {
            this.virtualDOM.clear();
        }
        this.eventManager.clear();

        // Clean up drag and drop listeners
        this.element.removeEventListener('dragstart', this.handleDragStart.bind(this));
        this.element.removeEventListener('dragover', this.handleDragOver.bind(this));
        this.element.removeEventListener('drop', this.handleDrop.bind(this));
        this.element.removeEventListener('dragend', this.handleDragEnd.bind(this));
    }
}