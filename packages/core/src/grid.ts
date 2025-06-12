import {
    Column,
    GridOptions,
    RowNode,
    GridApi,
    SortModel,
    FilterModel,
    CellClickedEvent,
    RowClickedEvent,
    ValueSetParams
} from './types';

export class Grid implements GridApi {
    private options: GridOptions;
    private element: HTMLElement;
    private rowNodes: Map<string | number, RowNode> = new Map();
    private selectedNodes: Set<string | number> = new Set();
    private sortModel: SortModel[] = [];
    private filterModel: Map<string, FilterModel> = new Map();
    private draggedColumn: Column | null = null;
    private draggedElement: HTMLElement | null = null;
    private resizeStartX: number = 0;
    private resizeColumn: Column | null = null;
    private resizeElement: HTMLElement | null = null;
    private originalEditValue: any;

    constructor(options: GridOptions) {
        this.options = {
            rowHeight: 40,
            headerHeight: 40,
            ...options
        };
        this.element = document.createElement('div');
        this.element.className = 'grid-container';
        this.initRowNodes();

        // 添加样式
        const style = document.createElement('style');
        style.textContent = `
            .grid-cell-content {
                position: relative;
                width: 100%;
                height: 100%;
                display: flex;
                align-items: center;
                padding: 0 8px;
            }
            .grid-cell-drag-handle {
                position: absolute;
                right: 2px;
                bottom: 2px;
                width: 6px;
                height: 6px;
                cursor: crosshair;
                opacity: 0;
                transition: opacity 0.2s;
                background-color: #1a73e8;
                border: 1px solid #fff;
            }
            .grid-cell:hover .grid-cell-drag-handle {
                opacity: 1;
            }
            .grid-drag-highlight {
                position: fixed;
                pointer-events: none;
                border: 1px dashed #1a73e8;
                background-color: rgba(26, 115, 232, 0.1);
                z-index: 1000;
            }
        `;
        document.head.appendChild(style);

        // 初始化拖拽填充功能
        this.initializeDragToFill();
    }

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
        const headerWrapper = document.createElement('div');
        headerWrapper.className = 'grid-header';
        headerWrapper.style.display = 'flex';

        const header = document.createElement('div');
        header.style.display = 'flex';
        header.style.height = `${this.options.headerHeight}px`;
        header.style.flex = '1';
        header.style.marginRight = '17px';

        // 添加右侧固定区域
        const headerRightArea = document.createElement('div');
        headerRightArea.className = 'grid-header-right-area';
        headerRightArea.style.height = `${this.options.headerHeight}px`;

        this.options.columns.forEach((col, index) => {
            const cell = document.createElement('div');
            cell.className = 'grid-header-cell';
            cell.style.width = `${col.width}px`;
            cell.setAttribute('data-field', col.field);
            
            // 添加列标题容器
            const titleContainer = document.createElement('div');
            titleContainer.className = 'grid-header-cell-content';
            
            const title = document.createElement('div');
            title.className = 'grid-header-cell-title';
            title.textContent = col.headerName;
            titleContainer.appendChild(title);

            // 添加排序和筛选按钮容器
            const actionContainer = document.createElement('div');
            actionContainer.className = 'grid-header-cell-actions';

            // 添加排序按钮
            if (col.sortable) {
                const sortButton = document.createElement('button');
                sortButton.className = 'grid-sort-button';
                sortButton.innerHTML = `
                    <svg class="sort-icon" width="16" height="16" viewBox="0 0 16 16">
                        <path class="sort-up" d="M8 4l4 4H4z"/>
                        <path class="sort-down" d="M8 12l4-4H4z"/>
                    </svg>
                `;
                
                const existingSort = this.sortModel.find(s => s.colId === col.field);
                if (existingSort) {
                    sortButton.setAttribute('data-sort', existingSort.sort);
                }
                
                sortButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.handleSortClick(e, col);
                });
                
                actionContainer.appendChild(sortButton);
            }

            // 添加筛选按钮
            if (col.filterable) {
                const filterButton = document.createElement('button');
                filterButton.className = 'grid-filter-button';
                filterButton.innerHTML = `
                    <svg class="filter-icon" width="16" height="16" viewBox="0 0 16 16">
                        <path d="M2 2h12l-5 6v6l-2-2V8z"/>
                    </svg>
                `;
                
                const hasFilter = this.filterModel.has(col.field);
                if (hasFilter) {
                    filterButton.classList.add('active');
                }
                
                filterButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.showFilterMenu(e, col);
                });
                
                actionContainer.appendChild(filterButton);
            }

            titleContainer.appendChild(actionContainer);
            cell.appendChild(titleContainer);

            // 添加拖拽功能
            cell.setAttribute('draggable', 'true');
            cell.addEventListener('dragstart', (e) => this.handleDragStart(e, col, cell));
            cell.addEventListener('dragover', this.handleDragOver);
            cell.addEventListener('drop', (e) => this.handleDrop(e, col, index));
            cell.addEventListener('dragend', (e) => this.handleDragEnd(e));

            // 添加列宽调整功能
            if (col.resizable !== false) {
                const resizer = document.createElement('div');
                resizer.className = 'column-resizer';
                cell.appendChild(resizer);

                resizer.addEventListener('mousedown', (e) => this.handleResizeStart(e, col, cell));
            }

            header.appendChild(cell);
        });

        headerWrapper.appendChild(header);
        headerWrapper.appendChild(headerRightArea);
        return headerWrapper;
    }

    private renderBody() {
        const body = document.createElement('div');
        body.className = 'grid-body';

        const content = document.createElement('div');
        content.className = 'grid-content';

        // 创建滚动条容器
        const scrollbarContainer = document.createElement('div');
        scrollbarContainer.className = 'scrollbar-container';

        // 创建垂直滚动条
        const verticalScrollbar = document.createElement('div');
        verticalScrollbar.className = 'vertical-scrollbar';
        const verticalThumb = document.createElement('div');
        verticalThumb.className = 'scrollbar-thumb';
        verticalScrollbar.appendChild(verticalThumb);

        // 创建水平滚动条
        const horizontalScrollbar = document.createElement('div');
        horizontalScrollbar.className = 'horizontal-scrollbar';
        const horizontalThumb = document.createElement('div');
        horizontalThumb.className = 'scrollbar-thumb';
        horizontalScrollbar.appendChild(horizontalThumb);

        // 添加滚动条到容器
        scrollbarContainer.appendChild(verticalScrollbar);
        scrollbarContainer.appendChild(horizontalScrollbar);

        // 监听内容滚动
        content.addEventListener('scroll', () => {
            const { scrollTop, scrollHeight, clientHeight, scrollLeft, scrollWidth, clientWidth } = content;
            
            // 更新垂直滚动条
            const verticalRatio = clientHeight / scrollHeight;
            const verticalThumbHeight = Math.max(30, verticalRatio * clientHeight);
            verticalThumb.style.height = `${verticalThumbHeight}px`;
            verticalThumb.style.top = `${(scrollTop / scrollHeight) * clientHeight}px`;

            // 更新水平滚动条
            const horizontalRatio = clientWidth / scrollWidth;
            const horizontalThumbWidth = Math.max(30, horizontalRatio * clientWidth);
            horizontalThumb.style.width = `${horizontalThumbWidth}px`;
            horizontalThumb.style.left = `${(scrollLeft / scrollWidth) * clientWidth}px`;

            // 同步 header 滚动
            const header = this.element.querySelector('.grid-header');
            if (header) {
                header.scrollLeft = scrollLeft;
            }
        });

        // 获取过滤和排序后的数据
        const displayedData = this.getFilteredAndSortedData();

        displayedData.forEach((row, rowIndex) => {
            const rowElement = document.createElement('div');
            rowElement.className = 'grid-row';
            rowElement.setAttribute('data-row-id', row.id?.toString() || rowIndex.toString());
            const rowHeight = this.options.rowHeight || 40;
            rowElement.style.height = `${rowHeight}px`;
            rowElement.style.position = 'absolute';
            rowElement.style.top = `${rowIndex * rowHeight}px`;
            rowElement.style.left = '0';
            rowElement.style.right = '0';

            // 添加自定义行样式
            if (this.options.rowClass) {
                const node = this.rowNodes.get(row.id || rowIndex);
                if (node) {
                    const customClass = typeof this.options.rowClass === 'function'
                        ? this.options.rowClass({
                            data: row,
                            node,
                            rowIndex,
                            api: this
                        })
                        : this.options.rowClass;

                    if (typeof customClass === 'string' && customClass) {
                        rowElement.classList.add(customClass);
                    } else if (Array.isArray(customClass)) {
                        const validClasses = customClass.filter(className => className && typeof className === 'string');
                        if (validClasses.length > 0) {
                            rowElement.classList.add(...validClasses);
                        }
                    }
                }
            }

            // 添加行点击事件
            rowElement.addEventListener('click', (e) => this.handleRowClick(e, row, rowIndex));
            rowElement.addEventListener('dblclick', (e) => this.handleRowDoubleClick(e, row, rowIndex));

            this.options.columns.forEach(col => {
                const cell = document.createElement('div');
                cell.className = 'grid-cell';
                cell.style.width = `${col.width}px`;
                cell.setAttribute('data-field', col.field);

                const value = row[col.field];

                // 渲染单元格内容
                this.renderCell(cell, col, row, value, rowIndex);

                // 添加单元格事件处理
                cell.addEventListener('click', (e) => {
                    this.handleCellClick(e, col, row, value, rowIndex);
                    // 如果是可编辑单元格，单击也可以进入编辑模式
                    if (col.editable) {
                        this.startEditing(cell, col, row, value);
                    }
                });

                cell.addEventListener('dblclick', (e) => {
                    this.handleCellDoubleClick(e, col, row, value, rowIndex);
                    // 双击也可以进入编辑模式
                    if (col.editable) {
                        this.startEditing(cell, col, row, value);
                    }
                });

                rowElement.appendChild(cell);
            });

            content.appendChild(rowElement);
        });

        // 添加拖拽功能到滚动条
        let isDragging = false;
        let startY = 0;
        let startX = 0;
        let startScrollTop = 0;
        let startScrollLeft = 0;

        verticalThumb.addEventListener('mousedown', (e) => {
            isDragging = true;
            startY = e.clientY;
            startScrollTop = content.scrollTop;
            document.body.style.userSelect = 'none';
        });

        horizontalThumb.addEventListener('mousedown', (e) => {
            isDragging = true;
            startX = e.clientX;
            startScrollLeft = content.scrollLeft;
            document.body.style.userSelect = 'none';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            if (Math.abs(e.clientY - startY) > Math.abs(e.clientX - startX)) {
                // 垂直滚动
                const deltaY = e.clientY - startY;
                const ratio = content.scrollHeight / content.clientHeight;
                content.scrollTop = startScrollTop + deltaY * ratio;
            } else {
                // 水平滚动
                const deltaX = e.clientX - startX;
                const ratio = content.scrollWidth / content.clientWidth;
                content.scrollLeft = startScrollLeft + deltaX * ratio;
                
                // 同步 header 滚动
                const header = this.element.querySelector('.grid-header');
                if (header) {
                    header.scrollLeft = content.scrollLeft;
                }
            }
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
            document.body.style.userSelect = '';
        });

        body.appendChild(content);
        body.appendChild(scrollbarContainer);
        return body;
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

        // 如果单元格可编辑，添加类名
        if (column.editable) {
            cell.classList.add('editable');
        }

        // 清空单元格内容并添加新内容
        cell.innerHTML = '';
        cell.appendChild(cellContent);
    }

    private handleSortClick(e: MouseEvent, column: Column) {
        if (!column.sortable) return;

        const headerCell = (e.target as HTMLElement).closest('.grid-header-cell');
        if (!headerCell) return;

        const existingSort = this.sortModel.find(s => s.colId === column.field);
        
        // 更新排序状态
        if (!existingSort) {
            this.sortModel = [{ colId: column.field, sort: 'asc' }];
            headerCell.setAttribute('data-sort', 'asc');
        } else if (existingSort.sort === 'asc') {
            this.sortModel = [{ colId: column.field, sort: 'desc' }];
            headerCell.setAttribute('data-sort', 'desc');
        } else {
            this.sortModel = [];
            headerCell.removeAttribute('data-sort');
        }

        // 清除其他列的排序状态
        const otherHeaders = this.element.querySelectorAll(`.grid-header-cell:not([data-field="${column.field}"])`);
        otherHeaders.forEach(header => header.removeAttribute('data-sort'));

        // 触发排序变更事件
        if (this.options.onSortChanged) {
            this.options.onSortChanged({ sortModel: this.sortModel, api: this });
        }

        this.refreshView();
    }

    private handleDragStart(e: DragEvent, column: Column, element: HTMLElement) {
        if (!e.dataTransfer) return;
        
        this.draggedColumn = column;
        this.draggedElement = element;
        
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', column.field);
        
        element.classList.add('dragging');
    }

    private handleDragOver(e: DragEvent) {
        e.preventDefault();
        e.dataTransfer!.dropEffect = 'move';
    }

    private handleDrop(e: DragEvent, targetColumn: Column, targetIndex: number) {
        e.preventDefault();
        
        if (!this.draggedColumn || this.draggedColumn === targetColumn) return;
        
        // 获取拖拽列的原始索引
        const sourceIndex = this.options.columns.indexOf(this.draggedColumn);
        
        // 重新排序列
        const columns = [...this.options.columns];
        columns.splice(sourceIndex, 1);
        columns.splice(targetIndex, 0, this.draggedColumn);
        
        // 更新列定义
        this.options.columns = columns;
        
        this.refreshView();
    }

    private handleDragEnd(e: DragEvent) {
        if (this.draggedElement) {
            this.draggedElement.classList.remove('dragging');
        }
        this.draggedColumn = null;
        this.draggedElement = null;
    }

    private handleResizeStart(e: MouseEvent, column: Column, element: HTMLElement) {
        e.preventDefault();
        this.resizeStartX = e.clientX;
        this.resizeColumn = column;
        this.resizeElement = element;
        document.body.style.cursor = 'col-resize';

        // 添加全局鼠标事件监听
        document.addEventListener('mousemove', this.handleResizeMove);
        document.addEventListener('mouseup', this.handleResizeEnd);
    }

    private handleResizeMove = (e: MouseEvent) => {
        if (!this.resizeColumn || !this.resizeElement) return;
        
        const diff = e.clientX - this.resizeStartX;
        const newWidth = Math.max(50, this.resizeColumn.width + diff);
        
        this.resizeColumn.width = newWidth;
        this.resizeElement.style.width = `${newWidth}px`;
        
        // 更新对应的数据单元格宽度
        const columnIndex = this.options.columns.indexOf(this.resizeColumn);
        const cells = this.element.querySelectorAll(`.grid-row .grid-cell:nth-child(${columnIndex + 1})`);
        cells.forEach(cell => (cell as HTMLElement).style.width = `${newWidth}px`);
        
        this.resizeStartX = e.clientX;
    }

    private handleResizeEnd = () => {
        this.resizeColumn = null;
        this.resizeElement = null;
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

    // 获取当前编辑单元格的值
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
        if (this.filterModel.size > 0) {
            data = data.filter(row => {
                return Array.from(this.filterModel.entries()).every(([columnId, model]) => {
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
        if (this.sortModel.length > 0) {
            data.sort((a, b) => {
                for (const sort of this.sortModel) {
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
        
        // 添加表头和表体
        this.element.appendChild(this.renderHeader());
        this.element.appendChild(this.renderBody());

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
            this.selectedNodes.add(node.id);
        });
        this.refreshView();
    }

    deselectAll(): void {
        this.selectedNodes.clear();
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
            this.selectedNodes.add(id);
            this.refreshView();
        }
    }

    getSelectedNodes(): RowNode[] {
        return Array.from(this.selectedNodes).map(id => this.rowNodes.get(id)!);
    }

    getSelectedRows(): any[] {
        return this.getSelectedNodes().map(node => node.data);
    }

    setSort(sortModel: SortModel[]): void {
        this.sortModel = sortModel;
        this.refreshView();
    }

    setFilter(columnId: string, filterModel: FilterModel): void {
        this.filterModel.set(columnId, filterModel);
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

    autoSizeColumns(columnIds?: string[]): void {
        // 这里可以实现自动调整列宽的逻辑
        // 可以根据内容计算最大宽度
    }

    refreshView(): void {
        if (this.element) {
            this.render(this.element.parentElement!);
        }
    }

    ensureIndexVisible(index: number, position: 'top' | 'middle' | 'bottom' = 'middle'): void {
        const body = this.element.querySelector('.grid-body');
        if (!body) return;
        
        const rowElement = body.children[index] as HTMLElement;
        if (!rowElement) return;
        
        const bodyRect = body.getBoundingClientRect();
        const rowRect = rowElement.getBoundingClientRect();
        
        let scrollTop;
        switch (position) {
            case 'top':
                scrollTop = rowRect.top - bodyRect.top;
                break;
            case 'bottom':
                scrollTop = rowRect.bottom - bodyRect.bottom;
                break;
            case 'middle':
            default:
                scrollTop = rowRect.top - bodyRect.top - (bodyRect.height - rowRect.height) / 2;
        }
        
        body.scrollTop = scrollTop;
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
            const filterModel = this.filterModel.get(column.field) || {
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
                        this.filterModel.set(column.field, model);
                    } else {
                        this.filterModel.delete(column.field);
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
        const filterModel = this.filterModel.get(column.field) || {
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
                this.filterModel.set(column.field, {
                    type: typeSelect.value as FilterModel['type'],
                    filter: value,
                    filterType: 'text'
                });
            } else {
                this.filterModel.delete(column.field);
            }
            this.refreshView();
            menu.remove();
        });
        
        // 清除按钮
        const clearButton = document.createElement('button');
        clearButton.textContent = '清除';
        clearButton.addEventListener('click', () => {
            this.filterModel.delete(column.field);
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
        
        const startRect = startCell.getBoundingClientRect();
        const endRect = endCell.getBoundingClientRect();
        
        const highlight = document.createElement('div');
        highlight.className = 'grid-drag-highlight';
        highlight.style.position = 'absolute';
        highlight.style.top = `${Math.min(startRect.top, endRect.top)}px`;
        highlight.style.left = `${Math.min(startRect.left, endRect.left)}px`;
        highlight.style.width = `${Math.abs(endRect.left - startRect.left) + endRect.width}px`;
        highlight.style.height = `${Math.abs(endRect.top - startRect.top) + endRect.height}px`;
        
        document.body.appendChild(highlight);
    }

    private clearDragHighlight() {
        const highlight = document.querySelector('.grid-drag-highlight');
        if (highlight) {
            highlight.remove();
        }
    }

    // 实现 GridApi 的批量赋值方法
    setValues(params: ValueSetParams): void {
        const { startNode, startColumn, endNode, endColumn, value, valueGenerator } = params;
        
        // 获取起始和结束位置
        const startRowIndex = startNode.rowIndex;
        const endRowIndex = endNode.rowIndex;
        const startColIndex = this.options.columns.indexOf(startColumn);
        const endColIndex = this.options.columns.indexOf(endColumn);
        
        // 确保有效的范围
        if (startRowIndex === -1 || endRowIndex === -1 || startColIndex === -1 || endColIndex === -1) {
            return;
        }
        
        // 遍历范围内的所有单元格
        for (let rowIndex = Math.min(startRowIndex, endRowIndex); 
             rowIndex <= Math.max(startRowIndex, endRowIndex); 
             rowIndex++) {
            
            for (let colIndex = Math.min(startColIndex, endColIndex);
                 colIndex <= Math.max(startColIndex, endColIndex);
                 colIndex++) {
                
                const node = this.getDisplayedRowAtIndex(rowIndex);
                const column = this.options.columns[colIndex];
                
                if (node && column) {
                    const finalValue = valueGenerator ? 
                        valueGenerator({
                            rowIndex,
                            colId: column.field,
                            originalValue: node.data[column.field],
                            startValue: value
                        }) : 
                        value;
                    
                    // 更新值
                    node.data[column.field] = finalValue;
                    
                    // 触发值变更事件
                    if (this.options.onCellValueChanged) {
                        this.options.onCellValueChanged({
                            node,
                            data: node.data,
                            column,
                            colId: column.field,
                            value: finalValue,
                            oldValue: node.data[column.field],
                            newValue: finalValue,
                            event: new MouseEvent('click')
                        });
                    }
                }
            }
        }
        
        this.refreshView();
    }

    // 实现缺失的 GridApi 方法
    getFilterModel(): { [key: string]: FilterModel } {
        const model: { [key: string]: FilterModel } = {};
        this.filterModel.forEach((value, key) => {
            model[key] = value;
        });
        return model;
    }

    setFilterModel(model: { [key: string]: FilterModel }): void {
        this.filterModel.clear();
        Object.entries(model).forEach(([key, value]) => {
            this.filterModel.set(key, value);
        });
        this.refreshView();
    }

    clearFilters(): void {
        this.filterModel.clear();
        this.refreshView();
    }
}