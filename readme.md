# Grid Table

一个高性能、功能丰富的表格组件，支持虚拟滚动、单元格合并、自定义组件、树形结构等特性。

## 功能特点

### 基础功能
- **虚拟滚动**：高效处理大数据集，只渲染可视区域的行和列
- **列配置**：自定义列宽、冻结列、列排序
- **排序**：单列和多列排序
- **过滤**：自定义过滤条件和过滤器
- **选择**：行选择、单选和多选模式

### 单元格功能
- **单元格编辑**：内置和自定义编辑器
- **单元格合并**：支持行合并和列合并
- **单元格样式**：条件样式、自定义渲染
- **自定义组件**：完全可定制的单元格内容

### 高级功能
- **树形结构**：支持父子层级数据展示
- **行拖拽**：调整行顺序
- **列拖拽**：调整列顺序
- **行分组**：按字段分组显示数据
- **导出数据**：导出为CSV、Excel等格式

## 架构设计

Grid Table 采用模块化设计，主要包括以下核心模块：

### 核心类
- **Grid**：表格的主类，负责协调各个模块和提供API
- **VirtualDOMManager**：虚拟DOM管理，高效更新表格内容
- **ComponentManager**：组件管理，处理自定义组件的注册和渲染
- **EventManager**：事件管理，处理表格内的各种事件
- **ScrollSyncManager**：滚动同步，处理表头和表体的滚动同步

### 数据流
1. 用户提供数据和列定义
2. Grid 初始化各个管理器
3. VirtualDOMManager 创建虚拟DOM结构
4. 根据滚动位置计算可见行和列
5. 渲染可见单元格，应用样式和事件
6. 用户交互触发事件，更新数据和视图

## 使用指南

### 基础使用

```javascript
import { Grid } from 'grid-table';

// 创建表格实例
const grid = new Grid({
  columns: [
    { field: 'id', headerName: 'ID', width: 100 },
    { field: 'name', headerName: '名称', width: 200, editable: true },
    { field: 'age', headerName: '年龄', width: 100, editable: true }
  ],
  rowData: [
    { id: 1, name: '张三', age: 25 },
    { id: 2, name: '李四', age: 30 },
    { id: 3, name: '王五', age: 35 }
  ]
});

// 渲染到DOM
grid.render(document.getElementById('grid-container'));
```

### 列配置

```javascript
const columns = [
  // 基础列
  { 
    field: 'id', 
    headerName: 'ID', 
    width: 100,
    sortable: true,    // 启用排序
    filterable: true,  // 启用过滤
    frozen: true       // 冻结列
  },
  
  // 可编辑列
  { 
    field: 'name', 
    headerName: '名称', 
    width: 200,
    editable: true     // 启用编辑
  },
  
  // 自定义渲染列
  {
    field: 'status',
    headerName: '状态',
    width: 120,
    cellRenderer: {
      view: (params) => {
        const el = document.createElement('div');
        el.textContent = params.value;
        el.className = `status-${params.value}`;
        return el;
      },
      edit: (params) => {
        const select = document.createElement('select');
        select.innerHTML = `
          <option value="active">激活</option>
          <option value="inactive">未激活</option>
        `;
        select.value = params.value;
        
        select.onchange = () => {
          params.onComplete(select.value);
        };
        
        return select;
      }
    }
  }
];
```

### 自定义组件系统

```javascript
// 1. 创建组件
function TagViewComponent(params) {
  const container = document.createElement('div');
  container.className = 'tag-container';
  
  if (Array.isArray(params.value)) {
    params.value.forEach(tag => {
      const tagEl = document.createElement('span');
      tagEl.className = 'tag';
      tagEl.textContent = tag;
      container.appendChild(tagEl);
    });
  }
  
  return container;
}

function TagEditComponent(params) {
  // 编辑组件实现...
}

// 2. 注册组件
const grid = new Grid({
  columns: [
    // ...其他列
    { 
      field: 'tags', 
      headerName: '标签', 
      width: 200,
      editable: true,
      cellComponent: {
        type: 'tags',
        props: {
          options: ['重要', '紧急', '新客户', '老客户']
        }
      }
    }
  ],
  rowData: [/* ... */]
});

// 3. 获取组件管理器并注册组件
const componentManager = grid.getComponentManager();
componentManager.registerComponent('tags', {
  view: TagViewComponent,
  edit: TagEditComponent
});
```

### 单元格合并

```javascript
const grid = new Grid({
  columns: [/* ... */],
  rowData: [/* ... */],
  
  // 列合并
  colSpan: (params) => {
    if (params.rowIndex === 0 && params.colDef.field === 'name') {
      return 2; // 第一行的姓名单元格横跨2列
    }
    return 1;
  },
  
  // 行合并
  rowSpan: (params) => {
    if (params.rowIndex === 1 && params.field === 'city') {
      return 2; // 第二行的城市单元格纵跨2行
    }
    return 1;
  }
});
```

### 树形结构

```javascript
const treeData = [
  {
    id: '1',
    name: '电子产品',
    expanded: true,
    children: [
      {
        id: '1-1',
        name: '手机',
        expanded: true,
        children: [
          { id: '1-1-1', name: 'iPhone 14', price: 5999 },
          { id: '1-1-2', name: 'Samsung S23', price: 6299 }
        ]
      },
      {
        id: '1-2',
        name: '电脑',
        expanded: false,
        children: [
          { id: '1-2-1', name: 'MacBook Pro', price: 13999 }
        ]
      }
    ]
  }
];

const grid = new Grid({
  columns: [
    {
      field: 'name',
      headerName: '名称',
      width: 300
    },
    {
      field: 'price',
      headerName: '价格',
      width: 150
    }
  ],
  rowData: treeData
});
```

### 事件处理

```javascript
const grid = new Grid({
  columns: [/* ... */],
  rowData: [/* ... */],
  
  // 行点击事件
  onRowClicked: (event) => {
    console.log('点击行:', event.data);
  },
  
  // 单元格点击事件
  onCellClicked: (event) => {
    console.log('点击单元格:', event.value);
  },
  
  // 单元格值变更事件
  onCellValueChanged: (event) => {
    console.log('单元格值变更:', event.oldValue, '->', event.value);
  },
  
  // 选择变更事件
  onSelectionChanged: (event) => {
    console.log('已选择:', event.selectedNodes.length, '行');
  },
  
  // 排序变更事件
  onSortChanged: (event) => {
    console.log('排序变更:', event.sortModel);
  }
});
```

## API 参考

### Grid 选项

| 选项 | 类型 | 描述 |
|------|------|------|
| `columns` | `Array<Column>` | 列定义数组 |
| `rowData` | `Array<any>` | 行数据数组 |
| `rowHeight` | `number` | 行高（默认：40） |
| `headerHeight` | `number` | 表头高度（默认：40） |
| `rowSelection` | `'single'` \| `'multiple'` | 行选择模式 |
| `enableRowDrag` | `boolean` | 是否启用行拖拽 |
| `colSpan` | `Function` | 列合并函数 |
| `rowSpan` | `Function` | 行合并函数 |
| `rowClass` | `Function` | 行样式函数 |

### 列定义

| 属性 | 类型 | 描述 |
|------|------|------|
| `field` | `string` | 数据字段名 |
| `headerName` | `string` | 列标题 |
| `width` | `number` | 列宽 |
| `sortable` | `boolean` | 是否可排序 |
| `filterable` | `boolean` | 是否可过滤 |
| `editable` | `boolean` | 是否可编辑 |
| `frozen` | `boolean` | 是否冻结 |
| `cellRenderer` | `Object` \| `Function` | 单元格渲染器 |
| `cellComponent` | `Object` | 单元格组件配置 |
| `valueFormatter` | `Function` | 值格式化函数 |

### Grid API

| 方法 | 描述 |
|------|------|
| `render(container)` | 渲染表格到指定容器 |
| `setRowData(data)` | 设置行数据 |
| `getRowNode(id)` | 获取指定ID的行节点 |
| `selectAll()` | 选择所有行 |
| `deselectAll()` | 取消选择所有行 |
| `selectRow(id, clearOthers)` | 选择指定行 |
| `getSelectedNodes()` | 获取已选择的节点 |
| `getSelectedRows()` | 获取已选择的行数据 |
| `setSort(sortModel)` | 设置排序模型 |
| `setFilter(columnId, filterModel)` | 设置过滤条件 |
| `refreshView()` | 刷新视图 |
| `destroy()` | 销毁表格实例 |

## 项目结构

```
packages/
├── core/                  # 核心代码
│   ├── src/               # 源代码
│   │   ├── grid.ts        # 主类
│   │   ├── interface.ts   # 接口定义
│   │   ├── types/         # 类型定义
│   │   ├── managers/      # 各种管理器
│   │   │   ├── ComponentManager.ts    # 组件管理器
│   │   │   ├── EventManager.ts        # 事件管理器
│   │   │   ├── ScrollSyncManager.ts   # 滚动同步管理器
│   │   │   └── VirtualDOMManager.ts   # 虚拟DOM管理器
│   │   ├── renderers/     # 内置渲染器
│   │   └── style/         # 样式文件
│   ├── examples/          # 示例代码
│   └── dist/              # 编译后的代码
└── docs/                  # 文档
```

## 浏览器兼容性

- Chrome (最新版)
- Firefox (最新版)
- Safari (最新版)
- Edge (最新版)
- IE 11 (基本功能支持)

## 许可证

MIT