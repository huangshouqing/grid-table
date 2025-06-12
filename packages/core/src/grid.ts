import {
    GridApi,
    GridOptions,
    ColumnDef,
    RowNode,
    CellRendererParams,
    SortModel,
    FilterModel,
    RefreshCellsParams,
    ExportParams,
    CellClickedEvent,
    CellValueChangedEvent,
    RowSelectedEvent,
    RowClassParams,
    CellClassParams
} from './types';

export class Grid implements GridApi {
    private options: GridOptions;
    private container: HTMLElement;
    private rowHeight: number;
    private frozenPane!: HTMLElement;
    private scrollablePane!: HTMLElement;
    private frozenHeaderContainer!: HTMLElement;
    private scrollableHeaderContainer!: HTMLElement;
    private frozenBodyContainer!: HTMLElement;
    private scrollableBodyContainer!: HTMLElement;
    private horizontalScrollbar!: HTMLElement;
    private verticalScrollbar!: HTMLElement;
    private frozenColumns: ColumnDef[];
    private scrollableColumns: ColumnDef[];
    private rowNodes: Map<string | number, RowNode> = new Map();
    private selectedNodes: Set<string | number> = new Set();
    private sortModel: SortModel[] = [];
    private filterModel: Map<string, FilterModel> = new Map();

    constructor(options: GridOptions) {
        this.options = {
            ...options,
            rowData: options.rowData || [],
            defaultColDef: this.getDefaultColDef(options.defaultColDef)
        };
        this.container = options.container;
        this.rowHeight = options.rowHeight || 40;

        const frozenCount = options.frozenColumns || 0;
        this.frozenColumns = this.options.columns.slice(0, frozenCount);
        this.scrollableColumns = this.options.columns.slice(frozenCount);

        this.initRowNodes();
        this.renderStructure();
        this.renderVisibleRows();
        this.setupScrollSync();
        this.setupEventHandlers();
    }

    private getDefaultColDef(userDefault: Partial<ColumnDef> = {}): Partial<ColumnDef> {
        return {
            sortable: true,
            filter: true,
            editable: false,
            width: 150,
            ...userDefault
        };
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

    private createCell(column: ColumnDef, data: any, rowIndex: number): HTMLElement {
        const cell = document.createElement('div');
        cell.className = 'grid-cell';
        cell.style.width = `${column.width || 150}px`;

        const value = data[column.field];
        
        if (column.cellRenderer) {
            const params: CellRendererParams = {
                value,
                data,
                rowIndex,
                colId: column.field,
                column,
                api: this,
                node: cell,
                refreshCell: () => this.refreshCell(cell, column, data, rowIndex)
            };
            
            const result = column.cellRenderer(params);
            if (typeof result === 'string') {
                cell.innerHTML = result;
            } else if (result instanceof HTMLElement) {
                cell.appendChild(result);
            }
        } else if (column.editable) {
            const input = document.createElement('input');
            input.value = value?.toString() || '';
            input.addEventListener('change', (e) => this.handleCellValueChange(e, column, data, rowIndex));
            cell.appendChild(input);
        } else {
            cell.textContent = value?.toString() || '';
        }

        if (this.options.cellClass) {
            const cellClass = typeof this.options.cellClass === 'function'
                ? this.options.cellClass({
                    value,
                    data,
                    node: this.rowNodes.get(data.id || rowIndex)!,
                    colDef: column,
                    rowIndex,
                    api: this,
                    column,
                    colId: column.field,
                    refreshCell: () => this.refreshCell(cell, column, data, rowIndex)
                })
                : this.options.cellClass;

            if (Array.isArray(cellClass)) {
                cell.classList.add(...cellClass);
            } else {
                cell.classList.add(cellClass);
            }
        }

        return cell;
    }

    private refreshCell(cell: HTMLElement, column: ColumnDef, data: any, rowIndex: number) {
        const newCell = this.createCell(column, data, rowIndex);
        cell.parentElement?.replaceChild(newCell, cell);
    }

    private handleCellValueChange(e: Event, column: ColumnDef, data: any, rowIndex: number) {
        const input = e.target as HTMLInputElement;
        const oldValue = data[column.field];
        const newValue = input.value;
        
        data[column.field] = newValue;
        
        if (this.options.onCellValueChanged) {
            this.options.onCellValueChanged({
                node: this.rowNodes.get(data.id || rowIndex)!,
                data,
                column,
                colId: column.field,
                value: newValue,
                oldValue,
                newValue,
                event: e as unknown as MouseEvent
            });
        }
    }

    private renderVisibleRows() {
        const rowData = this.getFilteredAndSortedData();
        const currentScrollTop = this.verticalScrollbar.scrollTop;
        const startIndex = Math.floor(currentScrollTop / this.rowHeight);
        const visibleRowCount = Math.ceil(this.scrollableBodyContainer.clientHeight / this.rowHeight);
        const endIndex = Math.min(startIndex + visibleRowCount + 1, rowData.length);

        // 清空现有内容
        this.frozenBodyContainer.innerHTML = '';
        this.scrollableBodyContainer.innerHTML = '';

        // 创建内容容器
        const frozenContent = document.createElement('div');
        frozenContent.className = 'grid-content';
        frozenContent.style.position = 'absolute';
        frozenContent.style.width = '100%';
        frozenContent.style.top = '0';
        frozenContent.style.transform = `translateY(-${currentScrollTop}px)`;

        const scrollableContent = document.createElement('div');
        scrollableContent.className = 'grid-content';
        scrollableContent.style.position = 'absolute';
        scrollableContent.style.width = '100%';
        scrollableContent.style.top = '0';
        scrollableContent.style.transform = `translateY(-${currentScrollTop}px)`;

        // 渲染可见行
        for (let i = startIndex; i < endIndex; i++) {
            const data = rowData[i];
            if (!data) continue;

            // 创建行元素
            const frozenRow = document.createElement('div');
            const scrollableRow = document.createElement('div');

            frozenRow.className = scrollableRow.className = 'grid-row';
            frozenRow.style.top = scrollableRow.style.top = `${i * this.rowHeight}px`;
            frozenRow.setAttribute('data-row-index', i.toString());
            scrollableRow.setAttribute('data-row-index', i.toString());

            // 添加行样式
            if (this.options.rowClass) {
                const rowClass = typeof this.options.rowClass === 'function'
                    ? this.options.rowClass({
                        data,
                        node: this.rowNodes.get(data.id || i)!,
                        rowIndex: i,
                        api: this
                    })
                    : this.options.rowClass;

                if (Array.isArray(rowClass)) {
                    frozenRow.classList.add(...rowClass);
                    scrollableRow.classList.add(...rowClass);
                } else {
                    frozenRow.classList.add(rowClass);
                    scrollableRow.classList.add(rowClass);
                }
            }

            // 渲染单元格
            this.frozenColumns.forEach(column => {
                frozenRow.appendChild(this.createCell(column, data, i));
            });

            this.scrollableColumns.forEach(column => {
                scrollableRow.appendChild(this.createCell(column, data, i));
            });

            frozenContent.appendChild(frozenRow);
            scrollableContent.appendChild(scrollableRow);
        }

        // 添加内容容器到视图
        this.frozenBodyContainer.appendChild(frozenContent);
        this.scrollableBodyContainer.appendChild(scrollableContent);

        // 更新垂直滚动条占位元素的高度
        const verticalScrollbarSpacer = this.verticalScrollbar.querySelector('.grid-scrollbar-spacer') as HTMLElement;
        verticalScrollbarSpacer.style.height = `${rowData.length * this.rowHeight}px`;
    }

    private getFilteredAndSortedData(): any[] {
        let data = Array.isArray(this.options.rowData) ? [...this.options.rowData] : [];
        
        // 应用过滤
        if (this.filterModel.size > 0) {
            data = data.filter(row => {
                return Array.from(this.filterModel.entries()).every(([columnId, model]) => {
                    const value = row[columnId];
                    const column = this.options.columns.find(col => col.field === columnId);
                    
                    if (column?.filterParams?.customFilter) {
                        return column.filterParams.customFilter(value, model.filter as string);
                    }
                    
                    // 实现默认过滤逻辑
                    if (model.filter && value !== undefined) {
                        return value.toString().toLowerCase().includes(model.filter.toString().toLowerCase());
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
                        const result = column.comparator(valueA, valueB, 
                            this.rowNodes.get(a.id)!, 
                            this.rowNodes.get(b.id)!);
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

    private setupEventHandlers() {
        // 处理单元格点击
        const handleCellClick = (e: MouseEvent, isDouble = false) => {
            const cell = (e.target as HTMLElement).closest('.grid-cell') as HTMLElement;
            if (!cell) return;
            
            const rowElement = cell.parentElement;
            if (!rowElement) return;
            
            const rowIndex = parseInt(rowElement.getAttribute('data-row-index') || '0', 10);
            const rowData = this.getFilteredAndSortedData();
            const data = rowData[rowIndex];
            if (!data) return;

            const columnIndex = Array.from(rowElement.children).indexOf(cell);
            const column = [...this.frozenColumns, ...this.scrollableColumns][columnIndex];
            if (!column) return;
            
            const eventParams = {
                node: this.rowNodes.get(data.id || rowIndex)!,
                data,
                column,
                colId: column.field,
                value: data[column.field],
                event: e
            };
            
            if (isDouble && this.options.onCellDoubleClicked) {
                this.options.onCellDoubleClicked(eventParams);
            } else if (!isDouble && this.options.onCellClicked) {
                this.options.onCellClicked(eventParams);
            }
        };

        this.container.addEventListener('click', e => handleCellClick(e));
        this.container.addEventListener('dblclick', e => handleCellClick(e, true));
    }

    // GridApi implementation
    public setRowData(data: any[]): void {
        this.options.rowData = data;
        this.initRowNodes();
        this.renderVisibleRows();
    }

    public getRowNode(id: string | number): RowNode | undefined {
        return this.rowNodes.get(id);
    }

    public getDisplayedRowAtIndex(index: number): RowNode | undefined {
        const filteredAndSortedData = this.getFilteredAndSortedData();
        const data = filteredAndSortedData[index];
        return data ? this.rowNodes.get(data.id || index) : undefined;
    }

    public getDisplayedRowCount(): number {
        return this.getFilteredAndSortedData().length;
    }

    public forEachNode(callback: (node: RowNode, index: number) => void): void {
        let index = 0;
        this.rowNodes.forEach(node => {
            callback(node, index);
            index++;
        });
    }

    public selectAll(): void {
        this.rowNodes.forEach(node => {
            node.selected = true;
            this.selectedNodes.add(node.id);
        });
        this.refreshView();
        if (this.options.onSelectionChanged) {
            this.options.onSelectionChanged();
        }
    }

    public deselectAll(): void {
        this.selectedNodes.clear();
        this.rowNodes.forEach(node => node.selected = false);
        this.refreshView();
        if (this.options.onSelectionChanged) {
            this.options.onSelectionChanged();
        }
    }

    public selectRow(id: string | number, clearOthers = true): void {
        if (clearOthers) {
            this.deselectAll();
        }
        const node = this.rowNodes.get(id);
        if (node) {
            node.selected = true;
            this.selectedNodes.add(id);
            this.refreshView();
            if (this.options.onRowSelected) {
                this.options.onRowSelected({ node, data: node.data, selected: true });
            }
            if (this.options.onSelectionChanged) {
                this.options.onSelectionChanged();
            }
        }
    }

    public getSelectedNodes(): RowNode[] {
        return Array.from(this.selectedNodes).map(id => this.rowNodes.get(id)!);
    }

    public getSelectedRows(): any[] {
        return this.getSelectedNodes().map(node => node.data);
    }

    public setSort(sortModel: SortModel[]): void {
        this.sortModel = sortModel;
        this.refreshView();
    }

    public setFilter(columnId: string, filterModel: FilterModel): void {
        this.filterModel.set(columnId, filterModel);
        this.refreshView();
    }

    public refreshCells(params?: RefreshCellsParams): void {
        // 实现刷新指定单元格的逻辑
        this.renderVisibleRows();
    }

    public setColumnDefs(colDefs: ColumnDef[]): void {
        this.options.columns = colDefs;
        const frozenCount = this.options.frozenColumns || 0;
        this.frozenColumns = colDefs.slice(0, frozenCount);
        this.scrollableColumns = colDefs.slice(frozenCount);
        this.renderStructure();
        this.renderVisibleRows();
    }

    public sizeColumnsToFit(): void {
        const totalWidth = this.container.clientWidth;
        const columnCount = this.options.columns.length;
        const width = Math.floor(totalWidth / columnCount);
        
        this.options.columns.forEach(col => {
            col.width = width;
        });
        
        this.renderStructure();
        this.renderVisibleRows();
    }

    public autoSizeColumns(columnIds?: string[]): void {
        // 实现自动调整列宽的逻辑
    }

    public exportDataAsCsv(params?: ExportParams): void {
        // 实现导出CSV的逻辑
    }

    public exportDataAsExcel(params?: ExportParams): void {
        // 实现导出Excel的逻辑
    }

    public showLoadingOverlay(): void {
        // 实现显示加载遮罩的逻辑
    }

    public hideOverlay(): void {
        // 实现隐藏遮罩的逻辑
    }

    public resetRowHeights(): void {
        this.renderVisibleRows();
    }

    public ensureIndexVisible(index: number, position: 'top' | 'middle' | 'bottom' = 'middle'): void {
        const rowTop = index * this.rowHeight;
        let scrollTop;
        
        switch (position) {
            case 'top':
                scrollTop = rowTop;
                break;
            case 'bottom':
                scrollTop = rowTop - this.scrollableBodyContainer.clientHeight + this.rowHeight;
                break;
            case 'middle':
            default:
                scrollTop = rowTop - (this.scrollableBodyContainer.clientHeight - this.rowHeight) / 2;
        }
        
        this.scrollableBodyContainer.scrollTop = Math.max(0, scrollTop);
    }

    public ensureNodeVisible(node: RowNode, position?: 'top' | 'middle' | 'bottom'): void {
        this.ensureIndexVisible(node.rowIndex, position);
    }

    public refreshView(): void {
        this.renderVisibleRows();
    }

    private setupScrollSync() {
        // 监听水平滚动条
        this.horizontalScrollbar.addEventListener('scroll', () => {
            // 同步水平滚动
            const scrollLeft = this.horizontalScrollbar.scrollLeft;
            this.scrollablePane.scrollLeft = scrollLeft;
            this.scrollableHeaderContainer.scrollLeft = scrollLeft;
            this.scrollableBodyContainer.scrollLeft = scrollLeft;
        });

        // 监听垂直滚动条
        this.verticalScrollbar.addEventListener('scroll', () => {
            const scrollTop = this.verticalScrollbar.scrollTop;
            this.updateVerticalScroll(scrollTop);
        });

        // 添加触控板和鼠标滚轮事件处理
        this.container.addEventListener('wheel', (e) => {
            // 阻止默认行为以自定义滚动
            e.preventDefault();

            const deltaX = e.deltaX;
            const deltaY = e.deltaY;
            
            // 处理垂直滚动
            if (deltaY !== 0) {
                const currentScrollTop = this.verticalScrollbar.scrollTop;
                const maxScrollTop = this.getMaxScrollTop();
                const newScrollTop = Math.max(0, Math.min(currentScrollTop + deltaY, maxScrollTop));
                
                this.verticalScrollbar.scrollTop = newScrollTop;
                this.updateVerticalScroll(newScrollTop);
            }
            
            // 处理水平滚动
            if (deltaX !== 0) {
                const newScrollLeft = this.horizontalScrollbar.scrollLeft + deltaX;
                this.horizontalScrollbar.scrollLeft = newScrollLeft;
                this.scrollablePane.scrollLeft = newScrollLeft;
                this.scrollableHeaderContainer.scrollLeft = newScrollLeft;
                this.scrollableBodyContainer.scrollLeft = newScrollLeft;
            }
        }, { passive: false });
    }

    private updateVerticalScroll(scrollTop: number) {
        const roundedScrollTop = Math.round(scrollTop);
        this.renderVisibleRows();
    }

    private getMaxScrollTop(): number {
        const totalHeight = this.getFilteredAndSortedData().length * this.rowHeight;
        const viewportHeight = this.scrollableBodyContainer.clientHeight;
        return Math.max(0, totalHeight - viewportHeight);
    }

    private renderStructure() {
        this.container.innerHTML = '';
        this.container.classList.add('grid-container-wrapper');

        // 计算冻结列的总宽度并设置为 CSS 变量
        const frozenWidth = this.frozenColumns.reduce((acc, col) => acc + (col.width || 150), 0);
        this.container.style.setProperty('--frozen-width', `${frozenWidth}px`);

        // 创建主体容器
        const mainContainer = document.createElement('div');
        mainContainer.className = 'grid-main';

        // 创建左侧固定区域
        this.frozenPane = document.createElement('div');
        this.frozenPane.className = 'grid-pane grid-pane-frozen';
        this.frozenPane.style.width = `${frozenWidth}px`;

        // 创建右侧可滚动区域
        this.scrollablePane = document.createElement('div');
        this.scrollablePane.className = 'grid-pane grid-pane-scrollable';

        // 创建表头容器
        this.frozenHeaderContainer = document.createElement('div');
        this.frozenHeaderContainer.className = 'grid-header';

        this.scrollableHeaderContainer = document.createElement('div');
        this.scrollableHeaderContainer.className = 'grid-header';

        // 创建表头行
        const createHeaderRow = (columns: ColumnDef[]) => {
            const row = document.createElement('div');
            row.className = 'grid-row';
            
            columns.forEach(column => {
                const cell = document.createElement('div');
                cell.className = 'grid-cell grid-header-cell';
                cell.style.width = `${column.width || 150}px`;
                cell.textContent = column.headerName || column.field;
                row.appendChild(cell);
            });
            
            return row;
        };

        this.frozenHeaderContainer.appendChild(createHeaderRow(this.frozenColumns));
        this.scrollableHeaderContainer.appendChild(createHeaderRow(this.scrollableColumns));

        // 创建内容容器
        this.frozenBodyContainer = document.createElement('div');
        this.frozenBodyContainer.className = 'grid-body grid-body-frozen';

        this.scrollableBodyContainer = document.createElement('div');
        this.scrollableBodyContainer.className = 'grid-body grid-body-scrollable';

        // 创建水平滚动条容器
        this.horizontalScrollbar = document.createElement('div');
        this.horizontalScrollbar.className = 'grid-scrollbar grid-scrollbar-horizontal';
        
        const horizontalScrollbarSpacer = document.createElement('div');
        horizontalScrollbarSpacer.className = 'grid-scrollbar-spacer';
        const totalScrollableWidth = this.scrollableColumns.reduce((acc, col) => acc + (col.width || 150), 0);
        horizontalScrollbarSpacer.style.width = `${totalScrollableWidth}px`;
        this.horizontalScrollbar.appendChild(horizontalScrollbarSpacer);

        // 创建垂直滚动条容器
        this.verticalScrollbar = document.createElement('div');
        this.verticalScrollbar.className = 'grid-scrollbar grid-scrollbar-vertical';
        
        const verticalScrollbarSpacer = document.createElement('div');
        verticalScrollbarSpacer.className = 'grid-scrollbar-spacer';
        this.verticalScrollbar.appendChild(verticalScrollbarSpacer);

        // 组装结构
        this.frozenPane.appendChild(this.frozenHeaderContainer);
        this.frozenPane.appendChild(this.frozenBodyContainer);

        this.scrollablePane.appendChild(this.scrollableHeaderContainer);
        this.scrollablePane.appendChild(this.scrollableBodyContainer);

        mainContainer.appendChild(this.frozenPane);
        mainContainer.appendChild(this.scrollablePane);
        mainContainer.appendChild(this.verticalScrollbar);

        const bottomContainer = document.createElement('div');
        bottomContainer.className = 'grid-bottom-container';
        bottomContainer.appendChild(this.horizontalScrollbar);

        this.container.appendChild(mainContainer);
        this.container.appendChild(bottomContainer);
    }
} 