export interface CellRendererParams {
    value: any;
    data: any;
    rowIndex: number;
    colId: string;
    column: ColumnDef;
    api: GridApi;
    node: HTMLElement;
    // 用于编辑状态
    isEditing?: boolean;
    // 用于刷新单元格
    refreshCell: () => void;
}

export type CellRenderer = (params: CellRendererParams) => HTMLElement | string;

export interface ColumnDef {
    field: string;
    headerName?: string;
    width?: number;
    cellRenderer?: (params: CellRendererParams) => HTMLElement | string;
    editable?: boolean;
    sortable?: boolean;
    filter?: boolean;
    // 自定义过滤器
    filterParams?: {
        filterOptions?: string[];
        customFilter?: (value: any, filterText: string) => boolean;
    };
    // 自定义排序
    comparator?: (valueA: any, valueB: any, nodeA: RowNode, nodeB: RowNode) => number;
}

export interface RowNode {
    id: string | number;
    data: any;
    rowIndex: number;
    selected?: boolean;
    expanded?: boolean;
    // 用于树形结构
    parent?: RowNode;
    children?: RowNode[];
    level?: number;
}

export interface GridApi {
    // 数据操作
    setRowData(data: any[]): void;
    getRowNode(id: string | number): RowNode | undefined;
    getDisplayedRowAtIndex(index: number): RowNode | undefined;
    getDisplayedRowCount(): number;
    forEachNode(callback: (node: RowNode, index: number) => void): void;
    
    // 选择相关
    selectAll(): void;
    deselectAll(): void;
    selectRow(id: string | number, clearOthers?: boolean): void;
    getSelectedNodes(): RowNode[];
    getSelectedRows(): any[];
    
    // 排序和过滤
    setSort(sortModel: SortModel[]): void;
    setFilter(columnId: string, filterModel: FilterModel): void;
    refreshCells(params?: RefreshCellsParams): void;
    
    // 列操作
    setColumnDefs(colDefs: ColumnDef[]): void;
    sizeColumnsToFit(): void;
    autoSizeColumns(columnIds?: string[]): void;
    
    // 导出
    exportDataAsCsv(params?: ExportParams): void;
    exportDataAsExcel(params?: ExportParams): void;
    
    // 状态
    showLoadingOverlay(): void;
    hideOverlay(): void;
    
    // 行高度
    resetRowHeights(): void;
    
    // 滚动
    ensureIndexVisible(index: number, position?: 'top' | 'middle' | 'bottom'): void;
    ensureNodeVisible(node: RowNode, position?: 'top' | 'middle' | 'bottom'): void;
    
    // 刷新
    refreshView(): void;
}

export interface SortModel {
    colId: string;
    sort: 'asc' | 'desc';
}

export interface FilterModel {
    type: 'text' | 'number' | 'date' | 'set' | 'custom';
    filter?: string | number | Date;
    filterTo?: string | number | Date;
    operator?: 'AND' | 'OR';
    condition1?: FilterCondition;
    condition2?: FilterCondition;
}

export interface FilterCondition {
    type: string;
    filter: any;
    filterType?: string;
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
    column: ColumnDef;
    colDef: ColumnDef;
}

export interface ProcessCellParams {
    value: any;
    node: RowNode;
    column: ColumnDef;
    api: GridApi;
}

export interface GridOptions {
    container: HTMLElement;
    columns: ColumnDef[];
    rowData: any[];
    rowHeight?: number;
    headerHeight?: number;
    frozenColumns?: number;
    
    // 事件处理
    onCellClicked?: (params: CellClickedEvent) => void;
    onCellDoubleClicked?: (params: CellClickedEvent) => void;
    onCellValueChanged?: (params: CellValueChangedEvent) => void;
    onRowSelected?: (params: RowSelectedEvent) => void;
    onSelectionChanged?: () => void;
    
    // 自定义类和样式
    rowClass?: string | ((params: RowClassParams) => string | string[]);
    cellClass?: string | ((params: CellClassParams) => string | string[]);
    
    // 功能开关
    enableSorting?: boolean;
    enableFilter?: boolean;
    enableColResize?: boolean;
    enableRangeSelection?: boolean;
    
    // 默认列定义
    defaultColDef?: Partial<ColumnDef>;
}

export interface CellClickedEvent {
    node: RowNode;
    data: any;
    column: ColumnDef;
    colId: string;
    value: any;
    event: MouseEvent;
}

export interface CellValueChangedEvent extends CellClickedEvent {
    oldValue: any;
    newValue: any;
}

export interface RowSelectedEvent {
    node: RowNode;
    data: any;
    selected: boolean;
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
    colDef: ColumnDef;
    rowIndex: number;
    api: GridApi;
    column: ColumnDef;
    colId: string;
    refreshCell: () => void;
} 