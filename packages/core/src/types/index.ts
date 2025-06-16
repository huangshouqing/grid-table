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

// 组件接口 - 通用的组件参数类型
export interface ComponentParams {
    value: any;
    data: any;
    rowIndex: number;
    colId: string;
    column: Column;
    api: GridApi;
    node: RowNode;
    // 编辑器特有参数
    startValue?: any;  // 编辑开始时的值
    onComplete?: (newValue: any) => void;
    onCancel?: () => void;
    stopEditing?: (save: boolean, newValue?: any) => void;
}

// 组件接口 - 单元格组件接口
export interface CellComponent {
    // 初始化组件
    init?(params: ComponentParams): void;
    // 组件被附加到DOM后调用
    afterGuiAttached?(): void;
    // 获取组件的DOM元素
    getGui(): HTMLElement;
    // 数据刷新时调用
    refresh?(params: ComponentParams): boolean;
    // 组件销毁前调用
    destroy?(): void;
}

export interface ValueGetterParams {
    data: any;
    node: RowNode;
    column: Column;
    api: GridApi;
}

export interface Column {
    field: string;
    headerName: string;
    width: number;
    sortable?: boolean;
    resizable?: boolean;
    editable?: boolean;
    pinned?: 'left' | 'right'; // 列固定
    frozen?: boolean;
    fixed?: boolean;
    draggable?: boolean;          // 是否允许列拖拽
    // 特殊列类型
    checkboxSelection?: boolean;  // 是否显示复选框
    rowDrag?: boolean;            // 是否允许行拖拽
    treeColumn?: boolean;         // 是否作为树形结构的展开/折叠列
    // 合并单元格
    colSpan?: (params: CellClassParams) => number;  // 列合并
    formula?: string;
    // 修改渲染器定义
    cellRenderer?: 
        | ((params: CellRendererParams) => HTMLElement) 
        | { new(): CellComponent } 
        | { 
            // 非编辑状态的渲染器
            view: ((params: CellRendererParams) => HTMLElement) | { new(): CellComponent },
            // 编辑状态的渲染器
            edit?: ((params: CellEditorParams) => HTMLElement) | { new(): CellComponent }
        };
    // 组件定义
    cellComponent?: {
        // 组件类型标识
        type: string;
        // 组件属性
        props?: any;
    };
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
    draggable?: boolean;  // 是否可拖拽
    expanded?: boolean;   // 是否展开（用于父子行）
    parent?: RowNode;     // 父节点
    children?: RowNode[]; // 子节点
    level?: number;       // 节点层级
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
    // 新增行操作API
    addRow(data: any, position?: 'top' | 'bottom'): void;
    removeRow(id: string | number): void;
    moveRow(fromIndex: number, toIndex: number): void;
    refreshCell(params: RefreshCellParams): void;
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
    treeData?: boolean;
    
    // 行合并
    rowSpan?: (params: RowSpanParams) => number;
    
    // 事件处理
    onCellClicked?: (event: CellClickedEvent) => void;
    onCellDoubleClicked?: (event: CellClickedEvent) => void;
    onCellValueChanged?: (event: CellValueChangedEvent) => void;
    onRowClicked?: (event: RowClickedEvent) => void;
    onRowDoubleClicked?: (event: RowClickedEvent) => void;
    onSortChanged?: (event: SortChangedEvent) => void;
    onRowDragEnd?: (event: RowDragEndEvent) => void;  // 行拖拽结束事件
    onColumnMoved?: (event: ColumnMovedEvent) => void; // 列移动事件
    onSelectionChanged?: (event: SelectionChangedEvent) => void;  // 选择变更事件
    
    // 自定义类和样式
    rowClass?: string | ((params: RowClassParams) => string | string[]);
    cellClass?: string | ((params: CellClassParams) => string | string[]);
    
    // 功能开关
    enableSorting?: boolean;
    enableFilter?: boolean;
    enableColResize?: boolean;
    enableRangeSelection?: boolean;
    enableRowDrag?: boolean;  // 是否启用行拖拽
    rowSelection?: 'single' | 'multiple';  // 行选择模式
    
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
    event?: MouseEvent | null;
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
    rowId: string | number;
    field: string;
    value: any;
}

export interface ValueGeneratorParams {
    rowIndex: number;
    colId: string;
    originalValue: any;
    startValue: any;
}

// 新增行拖拽事件接口
export interface RowDragEndEvent {
    node: RowNode;
    data: any;
    fromIndex: number;
    toIndex: number;
    event: MouseEvent;
}

export interface ColumnMovedEvent {
    column: Column;
    fromIndex: number;
    toIndex: number;
}

// 新增选择变更事件接口
export interface SelectionChangedEvent {
    selectedNodes: RowNode[];
    selectedRows: any[];
    api: GridApi;
}

// 行合并参数接口
export interface RowSpanParams {
    data: any;
    node: RowNode;
    rowIndex: number;
    field: string;
    colId: string;
    api: GridApi;
}

export interface RefreshCellParams {
    rowNode: RowNode;
    column: Column;
} 