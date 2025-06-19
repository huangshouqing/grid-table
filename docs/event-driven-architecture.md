# Grid Table 事件驱动架构

## 架构概述

Grid Table 事件驱动架构通过事件总线模式实现了视图操作和业务逻辑的解耦，提高了代码的可维护性和可扩展性。

![事件驱动架构图](../assets/event-driven-architecture.png)

## 核心组件

### 1. EventBus（事件总线）

事件总线是整个架构的核心，负责事件的发布和订阅。任何组件都可以通过事件总线发布事件，也可以订阅感兴趣的事件。

```typescript
// EventBus 的基本用法
// 发布事件
eventBus.publish('eventName', { eventData });

// 订阅事件
eventBus.subscribe('eventName', (eventData) => {
  // 处理事件
});
```

### 2. GridEventBusHandler（事件处理器）

专门负责处理所有通过事件总线发送的事件，并调用相应的 API 方法执行实际操作。这个类将事件监听和处理逻辑集中在一起，使 Grid 类能够更专注于其核心功能。

```typescript
// GridEventBusHandler 初始化
const eventBusHandler = new GridEventBusHandler(gridApi, eventBus);
```

### 3. 视图组件

视图组件（如单元格渲染器、按钮等）只负责用户界面交互，它们不直接调用 API 方法，而是通过发布事件来表达用户的意图。

```typescript
// 视图组件发布事件的示例
eventBus.publish('gridDataAction', {
  type: 'rowDeleteRequest',
  rowId: rowId,
  source: 'deleteButton'
});
```

## 事件类型

Grid Table 定义了几种主要的事件类型，每种类型对应不同的操作领域：

### 1. gridDataAction（数据操作意图）

表示用户想要执行的数据操作，如添加、删除、更新行等。这些事件会被 GridEventBusHandler 处理，执行相应的 API 方法。

常见的 gridDataAction 事件类型：
- `rowAddRequest`: 请求添加新行
- `rowDeleteRequest`: 请求删除行
- `rowUpdateRequest`: 请求更新行数据

### 2. gridDataChanged（数据变更通知）

表示数据已经发生了变化，这些事件通常在数据操作完成后发布，用于通知其他组件数据已经更新。

常见的 gridDataChanged 事件类型：
- `rowAdded`: 行已添加
- `rowRemoved`: 行已删除
- `rowUpdated`: 行已更新
- `dataLoaded`: 数据已加载
- `cellValueChanged`: 单元格值已变更

### 3. gridCellAction（单元格操作）

表示用户在单元格上执行的操作，如选择、编辑等。

常见的 gridCellAction 事件类型：
- `checkboxSelect`: 行复选框选择操作
- `headerCheckboxSelect`: 表头复选框选择操作
- `cellEditRequest`: 单元格编辑请求

### 4. gridSelectionChanged（选择状态变更）

表示行的选择状态发生了变化，如全选、取消全选、单行选择等。

常见的 gridSelectionChanged 事件类型：
- `selectAll`: 已全选
- `deselectAll`: 已取消全选
- `rowSelected`: 行已选择
- `rowDeleted`: 行删除后选择状态更新

### 5. gridUIAction（界面操作）

表示用户执行的界面操作，如排序、过滤、调整列宽等。

常见的 gridUIAction 事件类型：
- `sortRequest`: 排序请求
- `filterRequest`: 过滤请求
- `columnResizeRequest`: 列宽调整请求

## 实现示例

### CheckboxCellRenderer（复选框单元格渲染器）

```typescript
private onCheckboxChange = (event: Event): void => {
  const checked = this.checkbox.checked;
  const api = this.params.api;
  const node = this.params.node;
  const eventBus = api.getEventBus();
  
  if (checked) {
    // 勾选操作 - 发布行选择事件
    eventBus.publish('gridCellAction', {
      type: 'checkboxSelect',
      action: 'select',
      nodeId: node.id,
      maintainOtherSelections: true // 保持其他已选行
    });
  } else {
    // 取消勾选操作 - 发布取消选择事件
    eventBus.publish('gridCellAction', {
      type: 'checkboxSelect',
      action: 'deselect',
      nodeId: node.id,
      otherSelectedNodeIds: api.getSelectedNodes()
        .filter(selectedNode => selectedNode.id !== node.id)
        .map(selectedNode => selectedNode.id)
    });
  }
};
```

### DeleteButtonComponent（删除按钮组件）

```typescript
onDelete() {
  const rowId = this.data.id;
  const eventBus = this.api.getEventBus();
  
  // 发布删除请求事件
  if (eventBus) {
    eventBus.publish('gridDataAction', {
      type: 'rowDeleteRequest',
      rowId: rowId,
      data: this.data,
      source: 'deleteButton'
    });
  }
}
```

### GridEventBusHandler（事件处理器）

```typescript
private subscribeToDataActions(): void {
  this.eventBus.subscribe('gridDataAction', (event) => {
    // 处理行删除请求
    if (event.type === 'rowDeleteRequest') {
      const rowId = event.rowId;
      if (rowId !== undefined) {
        this.api.removeRow(rowId);
      }
    }
    // 处理行更新请求
    else if (event.type === 'rowUpdateRequest') {
      const { rowId, data } = event;
      if (rowId !== undefined && data) {
        this.api.updateRowData(rowId, data);
        
        if (event.rowIndex !== undefined) {
          this.api.refreshRow(event.rowIndex);
        }
      }
    }
  });
}
```

## 优势

1. **关注点分离**：视图组件只关心用户交互和界面渲染，不需要了解业务逻辑实现细节。

2. **松耦合**：组件之间通过事件通信，减少了直接依赖，易于维护和扩展。

3. **可测试性**：事件处理逻辑集中在 GridEventBusHandler 中，便于单元测试。

4. **可扩展性**：新功能可以通过添加新的事件类型和处理器实现，无需修改现有代码。

5. **可观察性**：所有操作都以事件的形式记录，便于调试和日志记录。

## 未来改进方向

1. **TypeScript 类型定义**：为每种事件类型定义明确的接口，提供更好的类型安全。

```typescript
interface RowDeleteRequestEvent {
  type: 'rowDeleteRequest';
  rowId: string | number;
  data?: any;
  source?: string;
}

type GridDataActionEvent = 
  | RowDeleteRequestEvent
  | RowAddRequestEvent
  | RowUpdateRequestEvent;
```

2. **事件中间件**：添加事件中间件支持，允许在事件处理前后执行额外逻辑，如日志记录、性能监控等。

3. **事件过滤器**：允许订阅者指定更复杂的过滤条件，只接收特定条件的事件。

4. **事件存储**：实现事件存储机制，支持事件重放和状态恢复。

5. **异步事件处理**：支持异步事件处理，提高性能和响应性。

## 结论

事件驱动架构为 Grid Table 提供了一种灵活、可扩展的架构模式，使组件之间的交互更加清晰和有序。通过事件总线，我们实现了视图操作和业务逻辑的解耦，提高了代码的可维护性和可测试性。

未来，我们将继续完善这一架构，添加更多功能，并优化性能和用户体验。 