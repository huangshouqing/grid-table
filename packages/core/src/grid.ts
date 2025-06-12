import {
    Column,
    GridOptions,
    RowNode,
    GridApi,
    SortModel,
    FilterModel,
    CellClickedEvent,
    RowClickedEvent
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

    constructor(options: GridOptions) {
        this.options = {
            rowHeight: 40,
            headerHeight: 40,
            ...options
        };
        this.element = document.createElement('div');
        this.element.className = 'grid-container';
        this.initRowNodes();
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
            
            // 添加列标题
            const title = document.createElement('div');
            title.className = 'grid-header-cell-title';
            title.textContent = col.headerName;
            cell.appendChild(title);

            // 添加排序图标
            if (col.sortable) {
                cell.classList.add('sortable');
                const sortIcon = document.createElement('div');
                sortIcon.className = 'sort-icon';
                cell.appendChild(sortIcon);

                // 添加排序点击事件
                cell.addEventListener('click', (e) => this.handleSortClick(e, col));
            }

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
            const rowHeight = this.options.rowHeight || 40;
            rowElement.style.height = `${rowHeight}px`;
            rowElement.style.top = `${rowIndex * rowHeight}px`;

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

                const value = row[col.field];

                // 处理单元格渲染
                if (col.cellRenderer) {
                    const node = this.rowNodes.get(row.id || rowIndex);
                    if (node) {
                        const customElement = col.cellRenderer({
                            value,
                            data: row,
                            rowIndex,
                            colId: col.field,
                            column: col,
                            api: this,
                            node
                        });
                        cell.appendChild(customElement);
                    }
                } else if (col.valueFormatter) {
                    cell.textContent = col.valueFormatter({
                        value,
                        data: row,
                        column: col
                    });
                } else {
                    cell.textContent = value?.toString() ?? '';
                }

                // 添加单元格点击事件
                cell.addEventListener('click', (e) => this.handleCellClick(e, col, row, value, rowIndex));
                cell.addEventListener('dblclick', (e) => this.handleCellDoubleClick(e, col, row, value, rowIndex));

                // 处理可编辑单元格
                if (col.editable) {
                    cell.classList.add('editable');
                    cell.addEventListener('dblclick', () => this.startEditing(cell, col, row, value));
                }

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
        const input = document.createElement('input');
        input.type = 'text';
        input.value = value?.toString() ?? '';
        input.className = 'cell-editor';
        
        // 保存原始内容
        const originalContent = cell.innerHTML;
        
        // 替换单元格内容为输入框
        cell.innerHTML = '';
        cell.appendChild(input);
        input.focus();
        
        // 处理完成编辑
        const finishEditing = (newValue: string) => {
            const oldValue = row[column.field];
            row[column.field] = newValue;
            
            // 恢复单元格显示
            if (column.cellRenderer) {
                const node = this.rowNodes.get(row.id);
                if (node) {
                    const customElement = column.cellRenderer({
                        value: newValue,
                        data: row,
                        rowIndex: node.rowIndex,
                        colId: column.field,
                        column,
                        api: this,
                        node
                    });
                    cell.innerHTML = '';
                    cell.appendChild(customElement);
                }
            } else if (column.valueFormatter) {
                cell.textContent = column.valueFormatter({
                    value: newValue,
                    data: row,
                    column
                });
            } else {
                cell.textContent = newValue;
            }
            
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
        };
        
        // 处理按键事件
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                finishEditing(input.value);
            } else if (e.key === 'Escape') {
                cell.innerHTML = originalContent;
            }
        });
        
        // 处理失去焦点
        input.addEventListener('blur', () => {
            finishEditing(input.value);
        });
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
}