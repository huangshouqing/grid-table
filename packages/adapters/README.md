# Grid Table 框架适配器

这个包提供了一套适配器，使不同的前端框架（React、Vue、Angular）能够以各自熟悉的方式开发表格组件，并将它们集成到 Grid Table 中。

## 安装

```bash
# 使用 npm
npm install @grid-table/core @grid-table/adapters

# 使用 yarn
yarn add @grid-table/core @grid-table/adapters

# 使用 pnpm
pnpm add @grid-table/core @grid-table/adapters
```

## 使用方法

### React

```jsx
import { Grid } from '@grid-table/core';
import { ReactAdapter } from '@grid-table/adapters';
import MyReactComponent from './MyReactComponent';

// 创建React适配器
const adapter = new ReactAdapter();

// 1. 将React组件注册为Grid Table组件
const componentDefinition = adapter.adaptComponent(MyReactComponent, {
  // 配置视图模式
  view: {
    // 自定义props处理函数
    propsHandler: (params) => ({
      value: params.value,
      rowData: params.data,
      // 其他props
    })
  },
  // 配置编辑模式
  edit: {
    propsHandler: (params) => ({
      initialValue: params.value,
      onSave: params.onComplete,
      onCancel: params.onCancel,
      // 其他props
    }),
    // 自定义值获取函数
    valueGetter: (component) => component.getValue()
  }
});

// 2. 使用适配器的注册组件工厂功能
adapter.registerComponentFactory('myComponent', MyReactComponent, {
  // 与上面相同的配置
});

// 创建Grid实例
const grid = new Grid({
  // grid配置
});

// 3. 直接使用componentDefinition
grid.componentManager.registerComponent('myComponent', componentDefinition);

// 或者4. 通过适配器获取已注册的组件
const factory = adapter.getComponentFactory('myComponent');
if (factory) {
  const componentDef = adapter.adaptComponent(factory.component, factory.options);
  grid.componentManager.registerComponent('myComponent', componentDef);
}
```

### Vue

```js
import { Grid } from '@grid-table/core';
import { VueAdapter } from '@grid-table/adapters';
import MyVueComponent from './MyVueComponent.vue';

// 创建Vue适配器
const adapter = new VueAdapter();

// 使用与React类似的方法
const componentDefinition = adapter.adaptComponent(MyVueComponent, {
  view: {
    propsHandler: (params) => ({
      modelValue: params.value,
      rowData: params.data
    })
  },
  edit: {
    propsHandler: (params) => ({
      modelValue: params.value,
      'onUpdate:modelValue': (value) => params.onComplete?.(value)
    })
  }
});

// 创建Grid实例并注册组件
const grid = new Grid({
  // grid配置
});
grid.componentManager.registerComponent('myVueComponent', componentDefinition);
```

### Angular

```ts
import { Component, NgZone, ApplicationRef } from '@angular/core';
import { Grid } from '@grid-table/core';
import { createAngularAdapter } from '@grid-table/adapters';
import { MyAngularComponent } from './my-angular.component';

@Component({
  // ...
})
export class AppComponent {
  constructor(private ngZone: NgZone, private appRef: ApplicationRef) {
    // 创建Angular适配器
    const adapter = createAngularAdapter(this.ngZone, this.appRef);
    
    // 使用与其他框架类似的方法
    const componentDefinition = adapter.adaptComponent(MyAngularComponent, {
      // 配置...
    });
    
    // 创建Grid实例并注册组件
    const grid = new Grid({
      // grid配置
    });
    grid.componentManager.registerComponent('myAngularComponent', componentDefinition);
  }
}
```

### 便捷工厂函数

也可以使用便捷工厂函数创建适配器：

```js
import { Grid } from '@grid-table/core';
import { createAdapter } from '@grid-table/adapters';

// 创建React适配器
const reactAdapter = createAdapter('react');

// 创建Vue适配器
const vueAdapter = createAdapter('vue');

// 创建Angular适配器（需要提供依赖）
const angularAdapter = createAdapter('angular', {
  ngZone: ngZoneInstance,
  applicationRef: appRefInstance
});
```

## 自定义默认Props处理函数

```js
const adapter = new ReactAdapter();

// 设置默认Props处理函数
adapter.setDefaultPropsHandler((params) => ({
  value: params.value,
  data: params.data,
  api: params.api,
  // 其他自定义props
  custom: 'custom value'
}));
``` 