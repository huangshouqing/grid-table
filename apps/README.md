# Grid Table 表格组件演示项目

这个目录包含两个演示项目，分别使用 Vue 和 React 框架来展示表格组件的使用方法。

## 项目结构

- `vue-demo/`: Vue 框架演示项目
- `react-demo/`: React 框架演示项目

## 功能演示

这两个示例项目都演示了以下功能：

1. 基本表格渲染
2. 排序和过滤
3. 单元格编辑
4. 批量填充（在启用了 `fillable: true` 的列）
5. 自定义组件：
   - 状态展示组件
   - 可交互按钮组件

## 运行演示项目

### Vue 项目

```bash
# 进入 Vue 演示项目
cd vue-demo

# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev
```

### React 项目

```bash
# 进入 React 演示项目
cd react-demo

# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev
```

## 自定义组件

两个项目都实现了相同的自定义组件，展示了如何在不同前端框架中使用表格的组件系统：

1. 状态组件 (`StatusCellComponent`): 根据状态值显示不同样式的标签
2. 按钮组件 (`ButtonCellComponent`): 显示可点击按钮，点击时会显示当前行的数据

组件在表格中的使用方式：

```javascript
// 列定义中
{
  field: 'status',
  headerName: '状态',
  width: 150,
  sortable: true,
  cellComponent: {
    type: 'status-cell',
    props: {}
  }
}
``` 