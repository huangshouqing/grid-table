import './style.css';
import { Grid, ColumnDef } from './grid';

const columns: ColumnDef[] = [
    { field: 'id', headerName: '物料编号', width: 100 },
    { field: 'name', headerName: '物料名称', width: 140 },
    { field: 'batch', headerName: '物料批次', width: 100, editable: true },
    { field: 'spec', headerName: '规格', width: 100 },
    { field: 'cas', headerName: 'CAS号', width: 100 },
    { field: 'ratio', headerName: '比例', width: 80 },
    { field: 'unit', headerName: '*单位', width: 70 },
    { field: 'mw', headerName: '分子量', width: 80 },
    { field: 'moles', headerName: '摩尔数', width: 80 },
    { field: 'percentage', headerName: '百分比', width: 80 },
    { field: 'density', headerName: '密度', width: 80 },
    { field: 'volume', headerName: '体积', width: 80 },
    { field: 'purity', headerName: '纯度', width: 80 },
    { field: 'supplier', headerName: '供应商', width: 120 },
    { field: 'manufacturer', headerName: '生产商', width: 120 },
    { field: 'storageTemp', headerName: '存储温度', width: 100 },
    { field: 'storageLife', headerName: '保质期', width: 100 },
    { field: 'lastCheckDate', headerName: '最后检查日期', width: 120 },
    { field: 'nextCheckDate', headerName: '下次检查日期', width: 120 },
    { field: 'status', headerName: '状态', width: 80 },
];

const data = Array.from({ length: 100 }, (_, i) => {
    const id = `B${String(10000 + i).padStart(5, '0')}`;
    const checkDate = new Date(2024, 0, 1);
    checkDate.setDate(checkDate.getDate() + i);
    const nextDate = new Date(checkDate);
    nextDate.setMonth(nextDate.getMonth() + 6);

    return {
        id,
        name: `物料 ${i + 1}`,
        batch: '请输入',
        spec: `规格 ${i + 1}`,
        cas: `${Math.floor(Math.random() * 1000)}-${Math.floor(Math.random() * 100)}-${Math.floor(Math.random() * 10)}`,
        ratio: (Math.random() * 10).toFixed(2),
        unit: 'g',
        mw: (Math.random() * 100 + 100).toFixed(2),
        moles: (Math.random()).toFixed(3),
        percentage: (Math.random() * 100).toFixed(1),
        density: (Math.random() * 2 + 0.5).toFixed(3),
        volume: (Math.random() * 1000).toFixed(1),
        purity: (Math.random() * 10 + 90).toFixed(2),
        supplier: `供应商 ${Math.floor(Math.random() * 5) + 1}`,
        manufacturer: `生产商 ${Math.floor(Math.random() * 3) + 1}`,
        storageTemp: `${Math.floor(Math.random() * 4) * 5}-${Math.floor(Math.random() * 4) * 5}℃`,
        storageLife: `${Math.floor(Math.random() * 24) + 12}个月`,
        lastCheckDate: checkDate.toLocaleDateString(),
        nextCheckDate: nextDate.toLocaleDateString(),
        status: Math.random() > 0.2 ? '正常' : '待检查',
    };
});

const gridContainer = document.getElementById('grid-container');

if (gridContainer) {
    new Grid({
        container: gridContainer,
        columns,
        data,
        frozenColumns: 2,
    });
}

export { Grid };
export type { ColumnDef, GridOptions } from './grid'; 