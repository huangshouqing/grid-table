export interface ColumnDef {
    field: string;
    headerName: string;
    width?: number;
    editable?: boolean;
}

export interface GridOptions {
    container: HTMLElement;
    columns: ColumnDef[];
    data: any[];
    rowHeight?: number;
    frozenColumns?: number;
}

export class Grid {
    private options: GridOptions;
    private container: HTMLElement;
    private rowHeight: number;
    private frozenPane!: HTMLElement;
    private scrollablePane!: HTMLElement;
    private frozenHeaderContainer!: HTMLElement;
    private scrollableHeaderContainer!: HTMLElement;
    private frozenBodyContainer!: HTMLElement;
    private scrollableBodyContainer!: HTMLElement;
    private frozenColumns: ColumnDef[];
    private scrollableColumns: ColumnDef[];

    constructor(options: GridOptions) {
        this.options = options;
        this.container = options.container;
        this.rowHeight = options.rowHeight || 40;

        const frozenCount = options.frozenColumns || 0;
        this.frozenColumns = this.options.columns.slice(0, frozenCount);
        this.scrollableColumns = this.options.columns.slice(frozenCount);

        this.renderStructure();
        this.renderVisibleRows();
        this.scrollableBodyContainer.addEventListener('scroll', this.onScroll.bind(this));
    }

    private onScroll() {
        // 同步垂直滚动
        this.frozenBodyContainer.scrollTop = this.scrollableBodyContainer.scrollTop;
        this.renderVisibleRows();
    }

    private createHeaderRow(columns: ColumnDef[]): HTMLDivElement {
        const headerRow = document.createElement('div');
        headerRow.className = 'grid-row';
        headerRow.style.height = `${this.rowHeight}px`;

        columns.forEach(col => {
            const cell = document.createElement('div');
            cell.className = 'grid-cell grid-header-cell';
            cell.style.width = `${col.width || 150}px`;
            cell.style.minWidth = `${col.width || 150}px`;
            cell.textContent = col.headerName;
            headerRow.appendChild(cell);
        });

        return headerRow;
    }

    private renderStructure() {
        this.container.innerHTML = '';
        this.container.classList.add('grid-container-wrapper');

        // 创建窗格
        this.frozenPane = document.createElement('div');
        this.frozenPane.className = 'grid-pane grid-pane-frozen';
        const frozenWidth = this.frozenColumns.reduce((acc, col) => acc + (col.width || 150), 0);
        this.frozenPane.style.width = `${frozenWidth}px`;

        this.scrollablePane = document.createElement('div');
        this.scrollablePane.className = 'grid-pane grid-pane-scrollable';

        // 创建表头容器
        this.frozenHeaderContainer = document.createElement('div');
        this.frozenHeaderContainer.className = 'grid-header';
        this.frozenHeaderContainer.appendChild(this.createHeaderRow(this.frozenColumns));

        this.scrollableHeaderContainer = document.createElement('div');
        this.scrollableHeaderContainer.className = 'grid-header';
        this.scrollableHeaderContainer.appendChild(this.createHeaderRow(this.scrollableColumns));

        // 创建主体容器
        this.frozenBodyContainer = document.createElement('div');
        this.frozenBodyContainer.className = 'grid-body grid-body-frozen';

        this.scrollableBodyContainer = document.createElement('div');
        this.scrollableBodyContainer.className = 'grid-body grid-body-scrollable';

        // 创建用于虚拟滚动的占位元素
        const scrollSpacer = document.createElement('div');
        scrollSpacer.style.height = `${this.options.data.length * this.rowHeight}px`;
        const totalScrollableWidth = this.scrollableColumns.reduce((acc, col) => acc + (col.width || 150), 0);
        scrollSpacer.style.width = `${totalScrollableWidth}px`;
        this.scrollableBodyContainer.appendChild(scrollSpacer);

        // 组装结构
        this.frozenPane.appendChild(this.frozenHeaderContainer);
        this.frozenPane.appendChild(this.frozenBodyContainer);
        this.scrollablePane.appendChild(this.scrollableHeaderContainer);
        this.scrollablePane.appendChild(this.scrollableBodyContainer);

        this.container.appendChild(this.frozenPane);
        this.container.appendChild(this.scrollablePane);
    }

    private renderVisibleRows() {
        const scrollTop = this.scrollableBodyContainer.scrollTop;
        const startIndex = Math.floor(scrollTop / this.rowHeight);
        const visibleRowsCount = Math.ceil(this.scrollableBodyContainer.clientHeight / this.rowHeight);
        const endIndex = Math.min(startIndex + visibleRowsCount + 5, this.options.data.length);

        // 清除现有行
        this.frozenBodyContainer.innerHTML = '';
        const scrollableContent = this.scrollableBodyContainer.querySelector(':scope > div')!;
        Array.from(this.scrollableBodyContainer.querySelectorAll('.grid-row')).forEach(row => row.remove());

        for (let i = startIndex; i < endIndex; i++) {
            const rowData = this.options.data[i];
            const createRow = (columns: ColumnDef[]) => {
                const row = document.createElement('div');
                row.className = 'grid-row';
                row.style.height = `${this.rowHeight}px`;
                row.style.top = `${i * this.rowHeight}px`;

                columns.forEach(colDef => {
                    const cell = document.createElement('div');
                    cell.className = 'grid-cell';
                    cell.style.width = `${colDef.width || 150}px`;
                    cell.style.minWidth = `${colDef.width || 150}px`;

                    if (colDef.editable) {
                        const input = document.createElement('input');
                        input.type = 'text';
                        input.value = rowData[colDef.field] || '';
                        input.addEventListener('change', (e) => {
                            rowData[colDef.field] = (e.target as HTMLInputElement).value;
                        });
                        cell.appendChild(input);
                    } else {
                        cell.textContent = rowData[colDef.field] || '';
                    }
                    row.appendChild(cell);
                });
                return row;
            };

            const frozenRow = createRow(this.frozenColumns);
            this.frozenBodyContainer.appendChild(frozenRow);

            const scrollableRow = createRow(this.scrollableColumns);
            scrollableContent.appendChild(scrollableRow);
        }
    }
} 