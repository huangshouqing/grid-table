# 组件化架构升级方案

本文档旨在规划和指导 Grid 表格库的组件化系统重构。新的架构将提供一套标准的组件生命周期和丰富的 API，使第三方开发者能够轻松地创建、集成和管理自定义组件。

## 核心理念

新架构围绕两大核心概念构建：

1.  **组件标准 (Component Standard)**: 定义一套所有组件都必须遵循的接口（Interface），确保组件与表格核心之间交互的一致性。
2.  **组件管理器 (Component Manager)**: 一个中心化的服务，负责处理组件的注册、实例化、生命周期管理、复用和销毁。

## 架构设计

### 1. 组件接口 (`IComponent`)

每个组件都是一个实现了 `IComponent` 接口的类或对象。

```typescript
// 定义组件初始化时接收的参数
export interface IComponentParams {
  value: any; // 单元格的值
  data: any; // 完整行数据
  colDef: ColumnDef; // 列定义
  api: GridApi; // 表格核心API
  eventBus: EventBus; // 事件总线
  onComplete: (value: any) => void; // (仅编辑组件) 用于通知表格编辑完成
  onCancel: () => void; // (仅编辑组件) 用于通知表格取消编辑
}

// 定义组件必须实现的接口
export interface IComponent {
  // 初始化方法，在组件创建后立即调用，且只调用一次。
  // params: 初始化参数
  init(params: IComponentParams): void;

  // 返回组件的根DOM元素
  getGui(): HTMLElement;

  // (可选) 刷新组件UI。当数据更新时调用。
  // 如果组件能处理刷新，则返回 true；否则表格将销毁并重建组件。
  refresh?(params: IComponentParams): boolean;

  // (可选) 组件销毁前调用的清理方法。用于释放资源，如移除事件监听器。
  destroy?(): void;
}
```

### 2. 组件管理器 (`ComponentManager`)

`ComponentManager` 是管理所有组件实例的中央枢纽。

-   **职责**:
    -   **注册**: 提供 `registerComponent(name, componentClass)` 和 `registerComponents(components)` 方法。
    -   **创建与实例化**: 根据列定义中的 `cellComponent` 类型，创建对应的视图（view）或编辑（edit）组件实例。
    -   **生命周期管理**: 按照定义的生命周期（创建 -> `init` -> `getGui` -> (可选)`refresh` -> `destroy`）管理组件。
    -   **组件复用 (池化)**: (高级优化) 为了提升性能，管理器可以缓存和复用不再可视的组件实例。

### 3. 事件总线 (`EventBus`)

一个简单的发布/订阅（Pub/Sub）系统，用于解耦组件与表格核心的通信。

-   **API**:
    -   `subscribe(eventName: string, callback: Function)`: 订阅事件。
    -   `publish(eventName: string, payload: any)`: 发布事件。
    -   `unsubscribe(eventName: string, callback: Function)`: 取消订阅。

组件可以通过 `params.eventBus` 监听表格的内部事件（如 `selectionChanged`, `rowClicked`）或发布自定义事件与其他组件通信。

## 实施步骤

我们将分阶段完成此次重构：

### **第一步：定义核心接口**

-   **任务**: 在 `src/interfaces/` 目录下创建新文件，定义 `IComponent` 和 `IComponentParams` TypeScript 接口。
-   **目的**: 为后续的所有开发工作提供一个清晰、类型安全的基础。

### **第二步：实现 `EventBus`**

-   **任务**: 创建一个 `EventBus` 类，实现基本的发布/订阅功能。
-   **目的**: 建立组件与表格之间的通信基础。

### **第三步：实现 `ComponentManager`**

-   **任务**: 创建 `ComponentManager` 类。实现组件的注册、创建和销毁逻辑。暂时不实现复杂的组件池化，先确保核心生命周期能正常工作。
-   **目的**: 构建组件管理的核心引擎。

### **第四步：集成到 `Grid` 核心**

-   **任务**:
    1.  在 `Grid` 的构造函数中实例化 `ComponentManager` 和 `EventBus`。
    2.  修改单元格渲染逻辑（`createCellElement` 或类似方法），当检测到 `colDef.cellComponent` 时，使用 `ComponentManager` 来创建和管理视图组件。
    3.  修改单元格编辑逻辑（`startEditingCell` 或类似方法），使其通过 `ComponentManager` 来创建和管理编辑组件。
-   **目的**: 让表格的渲染和编辑流程正式使用新的组件系统。

### **第五步：重构现有示例组件**

-   **任务**: 将 `packages/core/index.html` 中的 `TagViewComponent`, `TagEditComponent`, `AddressViewComponent` 和 `AddressEditComponent` 改造成遵循 `IComponent` 接口的类。
-   **目的**: 验证新架构的可用性，并提供最佳实践范例。

### **第六步：完善与优化**

-   **任务**:
    1.  实现 `refresh` 逻辑，允许组件在数据更新时进行高效刷新。
    2.  (可选) 为 `ComponentManager` 添加组件池化（caching/pooling）功能，以优化滚动性能。
    3.  完善文档，清晰地说明如何使用新的组件系统。
-   **目的**: 提升新架构的性能和开发者体验。 