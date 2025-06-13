优化建议文档
尽管您的代码功能已经非常强大，但仍有一些可以优化的方面，以提高其性能、可维护性和健壮性。
统一渲染逻辑
问题: 目前代码中存在两种 DOM 更新模式：一种是通过 VirtualDOMManager 进行更新（如 updateRow(rowIndex: number)），另一种是直接操作 DOM 元素（如 renderBody 和 updateRow(rowElement: HTMLElement, ...)）。这种混合模式会使代码难以理解和维护。
建议: 统一使用一种模式。VirtualDOMManager 是一个很好的方向，因为它能将 DOM 的变更批量处理，减少重绘和回流。建议完善 VirtualDOMManager 的功能，并在所有渲染相关的地方（包括 renderHeader, renderBody, refreshView）都通过它来操作 DOM，避免直接的 DOM API 调用。
代码结构拆分
问题: grid.ts 文件超过 2000 行，包含了所有逻辑，过于庞大。
建议: 将代码按功能拆分到不同文件中，例如：
grid.ts: 核心 Grid 类和主要逻辑。
rendering/: 存放所有渲染相关的逻辑，如 HeaderRenderer, BodyRenderer。
interactions/: 存放用户交互逻辑，如 ColumnDragHandler, ResizeHandler, CellEditHandler。
managers/: 存放 EventManager, ScrollSyncManager, VirtualDOMManager 等。
types.ts: 所有的类型定义。
修复类型和运行时错误
问题: Linter 报告了一些类型错误和潜在的运行时问题。
建议: 在进行新功能开发前，先解决这些问题。
Column 类型: 在 packages/core/src/types.ts 的 Column 接口中添加 fixed?: boolean 属性。
滚动位置缓存: 在 Grid 类中添加 lastScrollTop 和 lastScrollLeft 成员变量。
updateRow 重复定义: 这个问题与第一点相关，统一渲染逻辑后，这个问题将自然解决。
性能优化
问题: renderBody 方法会遍历 getFilteredAndSortedData() 返回的所有数据，即使大部分行在视口之外。当数据量巨大时，这可能会成为瓶颈。
建议: 优化 renderBody，使其只创建和渲染当前视口内以及缓冲区（Viewport + Buffer）的行元素，而不是创建所有行再用 transform 定位。这将显著减少初始渲染和数据更新时的元素数量。
