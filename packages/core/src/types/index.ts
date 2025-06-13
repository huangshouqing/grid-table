export interface CellRendererParams {
    value: any;
    data: any;
    rowIndex: number;
    colId: string;
    column: Column;
    api: GridApi;
    node: RowNode;
    // 用于刷新单元格
    refreshCell?: () => void;
}

// 新增编辑器参数接口
export interface CellEditorParams extends CellRendererParams {
    // 开始编辑时的值
    startValue: any;
    // 结束编辑的回调
    onComplete: (newValue: any) => void;
    // 取消编辑的回调
    onCancel: () => void;
}

export interface Column {
    field: string;
    headerName: string;
    width: number;
    sortable?: boolean;
    resizable?: boolean;
    editable?: boolean;
    frozen?: boolean;
    fixed?: boolean;
    // 修改渲染器定义
    cellRenderer?: {
        // 非编辑状态的渲染器
        view?: (params: CellRendererParams) => HTMLElement;
        // 编辑状态的渲染器
        edit?: (params: CellEditorParams) => HTMLElement;
    } | ((params: CellRendererParams) => HTMLElement); // 保持向后兼容
    valueFormatter?: (params: ValueFormatterParams) => string;
    comparator?: (valueA: any, valueB: any, nodeA: RowNode, nodeB: RowNode) => number;
    filterable?: boolean;
    filterParams?: {
        filterComponent?: (params: FilterComponentParams) => HTMLElement;
        filterPredicate?: (value: any, filterModel: FilterModel, data: any) => boolean;
        valueFormatter?: (value: any) => string;
        multiSelect?: boolean;
    };
    valueSetParams?: {
        valueGenerator?: (params: ValueGeneratorParams) => any;
    };
}

export interface RowNode {
    id: string | number;
    data: any;
    rowIndex: number;
    selected: boolean;
}

export interface GridApi {
    setRowData(data: any[]): void;
    getRowNode(id: string | number): RowNode | undefined;
    getDisplayedRowAtIndex(index: number): RowNode | undefined;
    getDisplayedRowCount(): number;
    forEachNode(callback: (node: RowNode, index: number) => void): void;
    selectAll(): void;
    deselectAll(): void;
    selectRow(id: string | number, clearOthers?: boolean): void;
    getSelectedNodes(): RowNode[];
    getSelectedRows(): any[];
    setSort(sortModel: SortModel[]): void;
    setFilter(columnId: string, filterModel: FilterModel): void;
    setColumnDefs(colDefs: Column[]): void;
    sizeColumnsToFit(): void;
    autoSizeColumns(columnIds?: string[]): void;
    refreshView(): void;
    ensureIndexVisible(index: number, position?: 'top' | 'middle' | 'bottom'): void;
    ensureNodeVisible(node: RowNode, position?: 'top' | 'middle' | 'bottom'): void;
    setValues(params: ValueSetParams): void;
    getFilterModel(): { [key: string]: FilterModel };
    setFilterModel(model: { [key: string]: FilterModel }): void;
    clearFilters(): void;
}

export interface SortModel {
    colId: string;
    sort: 'asc' | 'desc';
}

export interface FilterModel {
    type: 'equals' | 'notEqual' | 'contains' | 'notContains' | 'startsWith' | 'endsWith' | 'set';
    filter?: string | string[];
    filterType?: 'text' | 'number' | 'date' | 'set';
}

export interface RefreshCellsParams {
    rowNodes?: RowNode[];
    columns?: string[];
    force?: boolean;
}

export interface ExportParams {
    fileName?: string;
    columnIds?: string[];
    onlySelected?: boolean;
    skipHeader?: boolean;
    skipGroups?: boolean;
    skipFooters?: boolean;
    allColumns?: boolean;
    processHeaderCallback?: (params: ProcessHeaderParams) => string;
    processCellCallback?: (params: ProcessCellParams) => string;
}

export interface ProcessHeaderParams {
    column: Column;
    colDef: Column;
}

export interface ProcessCellParams {
    value: any;
    node: RowNode;
    column: Column;
    api: GridApi;
}

export interface GridOptions {
    container: HTMLElement;
    columns: Column[];
    rowData?: any[];
    rowHeight?: number;
    headerHeight?: number;
    frozenColumns?: number;
    
    // 事件处理
    onCellClicked?: (event: CellClickedEvent) => void;
    onCellDoubleClicked?: (event: CellClickedEvent) => void;
    onCellValueChanged?: (event: CellValueChangedEvent) => void;
    onRowClicked?: (event: RowClickedEvent) => void;
    onRowDoubleClicked?: (event: RowClickedEvent) => void;
    onSortChanged?: (event: SortChangedEvent) => void;
    
    // 自定义类和样式
    rowClass?: string | ((params: RowClassParams) => string | string[]);
    cellClass?: string | ((params: CellClassParams) => string | string[]);
    
    // 功能开关
    enableSorting?: boolean;
    enableFilter?: boolean;
    enableColResize?: boolean;
    enableRangeSelection?: boolean;
    
    // 默认列定义
    defaultColDef?: Partial<Column>;
}

export interface CellClickedEvent {
    node: RowNode;
    data: any;
    column: Column;
    colId: string;
    value: any;
    event: MouseEvent;
}

export interface CellValueChangedEvent {
    node: RowNode;
    data: any;
    column: Column;
    colId: string;
    value: any;
    oldValue: any;
    newValue: any;
    event: MouseEvent;
}

export interface RowClickedEvent {
    node: RowNode;
    data: any;
    event: MouseEvent;
}

export interface RowClassParams {
    data: any;
    node: RowNode;
    rowIndex: number;
    api: GridApi;
}

export interface CellClassParams {
    value: any;
    data: any;
    node: RowNode;
    colDef: Column;
    rowIndex: number;
    api: GridApi;
    column: Column;
    colId: string;
    refreshCell: () => void;
}

export interface ValueFormatterParams {
    value: any;
    data: any;
    column: Column;
}

export interface SortChangedEvent {
    sortModel: SortModel[];
    api: GridApi;
}

export interface DragStartedEvent {
    column: Column;
    event: MouseEvent;
}

export interface DragEndedEvent {
    column: Column;
    event: MouseEvent;
    newIndex: number;
}

export interface FilterComponentParams {
    column: Column;
    api: GridApi;
    value: any;
    filterModel: FilterModel;
    onFilterChanged: (filterModel: FilterModel) => void;
    getUniqueValues: () => any[];
}

export interface ValueSetParams {
    startNode: RowNode;
    startColumn: Column;
    endNode: RowNode;
    endColumn: Column;
    value: any;
    valueGenerator?: (params: ValueGeneratorParams) => any;
}

export interface ValueGeneratorParams {
    rowIndex: number;
    colId: string;
    originalValue: any;
    startValue: any;
} 