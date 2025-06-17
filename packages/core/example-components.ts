import { IComponent, IComponentParams } from './src/interface/components';

// 声明模块以扩展导入的接口
declare module './src/interface/components' {
  interface IComponentParams {
    onComplete?: (value: any) => void;
  }
}

// 添加类型定义
interface AddressValue {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
}

// 添加全局样式
const addGlobalStyles = () => {
  if (document.getElementById('grid-edit-component-styles')) {
    return; // 样式已存在，避免重复添加
  }
  
  const styleEl = document.createElement('style');
  styleEl.id = 'grid-edit-component-styles';
  styleEl.textContent = `
    /* 简单模式样式 */
    .simple-edit-mode {
      position: relative;
      display: flex;
      align-items: center;
      width: 100%;
      height: 100%;
      overflow: hidden;
    }
    
    .simple-edit-box {
      width: 100%;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 4px;
    }
    
    .simple-edit-button {
      background: #f1f1f1;
      border: 1px solid #ddd;
      border-radius: 3px;
      padding: 2px 8px;
      margin-left: 8px;
      cursor: pointer;
      font-size: 12px;
    }
    
    .simple-edit-button:hover {
      background: #e8e8e8;
    }
    
    /* 详细模式样式 */
    .detail-edit-mode {
      background: white;
      border: 1px solid #ddd;
      border-radius: 4px;
      box-shadow: 0 4px 8px rgba(0,0,0,0.1);
      overflow: hidden;
      width: auto;
      min-width: 250px;
      max-width: 400px;
    }
    
    .edit-title {
      background: #f7f7f7;
      border-bottom: 1px solid #eee;
      padding: 10px;
      font-weight: bold;
      display: flex;
      justify-content: space-between;
    }
    
    .edit-content {
      padding: 12px;
      max-height: 300px;
      overflow-y: auto;
    }
    
    .edit-actions {
      display: flex;
      justify-content: flex-end;
      padding: 10px;
      border-top: 1px solid #eee;
      background: #f7f7f7;
    }
    
    button.save-button, button.cancel-button {
      border: none;
      padding: 6px 12px;
      border-radius: 3px;
      cursor: pointer;
      margin-left: 8px;
      font-size: 14px;
    }
    
    button.save-button {
      background: #4a90e2;
      color: white;
    }
    
    button.save-button:hover {
      background: #3a80d2;
    }
    
    button.cancel-button {
      background: #f1f1f1;
    }
    
    button.cancel-button:hover {
      background: #e8e8e8;
    }
    
    /* 标签组件特定样式 */
    .tag-edit-container .checkbox-item {
      margin-bottom: 8px;
      display: flex;
      align-items: center;
    }
    
    .tag-edit-container .checkbox-item label {
      margin-left: 8px;
      cursor: pointer;
    }
    
    /* 地址组件特定样式 */
    .address-field {
      margin-bottom: 10px;
    }
    
    .address-field label {
      display: block;
      margin-bottom: 4px;
      font-weight: 500;
      font-size: 13px;
    }
    
    .address-field input {
      width: 100%;
      padding: 6px;
      border: 1px solid #ddd;
      border-radius: 3px;
      font-size: 14px;
    }
    
    .address-field input:focus {
      border-color: #4a90e2;
      outline: none;
    }
  `;
  
  document.head.appendChild(styleEl);
};

// 确保全局样式被添加
addGlobalStyles();

/**
 * 标签视图组件
 * 用于显示标签列表
 */
export class TagViewComponent implements IComponent {
  private container: HTMLElement;
  private params!: IComponentParams;

  constructor() {
    this.container = document.createElement("div");
    this.container.className = "tag-container";
  }

  init(params: IComponentParams): void {
    this.params = params;
    this.render();
  }

  getGui(): HTMLElement {
    return this.container;
  }

  refresh(params: IComponentParams): boolean {
    debugger
    this.params = params;
    this.container.innerHTML = '';
    this.render();
    return true;
  }
  
  destroy(): void {
    // 无需额外清理
  }

  private render(): void {
    if (Array.isArray(this.params.value)) {
      this.container.innerHTML = '';
      this.params.value.forEach((tag) => {
        const tagEl = document.createElement("span");
        tagEl.className = "tag";
        tagEl.textContent = tag;
        this.container.appendChild(tagEl);
      });
    }
  }
}

/**
 * 标签编辑组件 - 双阶段编辑
 */
export class TagEditComponent implements IComponent {
  private container: HTMLElement;
  private simpleModeContainer: HTMLElement;
  private detailModeContainer: HTMLElement;
  private params!: IComponentParams;
  private checkboxes: HTMLInputElement[] = [];
  private isDetailMode = false;
  
  // 单例实例
  private static instance: TagEditComponent | null = null;
  
  // 私有构造函数，防止通过new直接创建
  private constructor() {
    // 创建容器
    this.container = document.createElement("div");
    this.container.className = "tag-edit-container";
    
    // 创建简单模式容器
    this.simpleModeContainer = document.createElement("div");
    this.simpleModeContainer.className = "simple-edit-mode";
    this.container.appendChild(this.simpleModeContainer);
    
    // 创建详细模式容器 - 不放在container内，而是独立的
    this.detailModeContainer = document.createElement("div");
    this.detailModeContainer.className = "detail-edit-mode";
    this.detailModeContainer.style.display = "none";
    // 这里不添加到DOM中，而是等到需要显示时添加到body
  }
  
  /**
   * 获取单例实例
   */
  public static getInstance(): TagEditComponent {
    if (!TagEditComponent.instance) {
      console.log("[TagEdit] Creating singleton instance");
      TagEditComponent.instance = new TagEditComponent();
    }
    return TagEditComponent.instance;
  }

  init(params: IComponentParams): void {
    console.log("[TagEdit] init called");
    this.params = params;
    this.isDetailMode = false;
    
    // 清空并重新渲染
    this.simpleModeContainer.innerHTML = '';
    this.detailModeContainer.innerHTML = '';
    this.checkboxes = [];
    
    // 渲染简单模式视图
    this.renderSimpleMode();
    
    // 设置初始显示状态
    this.simpleModeContainer.style.display = "block";
    this.detailModeContainer.style.display = "none";
    
    // 确保详细模式容器不在DOM中
    if (document.body.contains(this.detailModeContainer)) {
      document.body.removeChild(this.detailModeContainer);
    }
  }

  getGui(): HTMLElement {
    return this.container;
  }

  refresh(params: IComponentParams): boolean {
    console.log("[TagEdit] refresh called");
    this.params = params;
    
    if (!this.isDetailMode) {
      this.simpleModeContainer.innerHTML = '';
      this.renderSimpleMode();
    } else {
      this.detailModeContainer.innerHTML = '';
      this.checkboxes = [];
      this.renderDetailMode();
      this.positionDetailMode();
    }
    
    return true;
  }

  destroy(): void {
    console.log("[TagEdit] destroy called");
    // 移除所有事件监听器
    this.checkboxes.forEach(checkbox => {
      checkbox.removeEventListener('change', this.handleChange);
    });
    
    // 移除详细模式容器，如果它在DOM中
    if (document.body.contains(this.detailModeContainer)) {
      document.body.removeChild(this.detailModeContainer);
    }
  }
  
  /**
   * 渲染简单模式UI
   */
  private renderSimpleMode(): void {
    const selectedCount = Array.isArray(this.params.value) ? this.params.value.length : 0;
    
    // 创建简单编辑框
    const editBox = document.createElement("div");
    editBox.className = "simple-edit-box";
    
    const editText = document.createElement("span");
    editText.textContent = selectedCount > 0 ? 
      `已选择 ${selectedCount} 个标签` : 
      "点击编辑标签";
    editBox.appendChild(editText);
    
    const editButton = document.createElement("button");
    editButton.className = "simple-edit-button";
    editButton.textContent = "编辑";
    editButton.addEventListener("click", this.showDetailMode);
    
    editBox.appendChild(editButton);
    this.simpleModeContainer.appendChild(editBox);
  }

  /**
   * 渲染详细编辑模式UI
   */
  private renderDetailMode(): void {
    // 可选标签列表
    const availableTags = this.params.props?.options || [
      "重要",
      "紧急",
      "新客户",
      "老客户",
      "潜在客户",
      "待跟进",
      "已完成",
    ];

    // 当前选中的标签
    const selectedTags = Array.isArray(this.params.value) ? this.params.value : [];
    
    // 添加标题
    const titleDiv = document.createElement("div");
    titleDiv.className = "edit-title";
    titleDiv.textContent = "编辑标签";
    this.detailModeContainer.appendChild(titleDiv);
    
    // 添加内容容器
    const contentDiv = document.createElement("div");
    contentDiv.className = "edit-content";

    // 创建复选框列表
    availableTags.forEach((tag) => {
      const item = document.createElement("div");
      item.className = "checkbox-item";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = selectedTags.includes(tag);
      checkbox.value = tag;
      checkbox.id = `tag-${tag}-${Math.random().toString(36).substring(2, 9)}`;

      const label = document.createElement("label");
      label.htmlFor = checkbox.id;
      label.textContent = tag;

      item.appendChild(checkbox);
      item.appendChild(label);
      contentDiv.appendChild(item);

      // 保存复选框引用
      this.checkboxes.push(checkbox);

      // 添加变更事件
      checkbox.addEventListener("change", this.handleChange);
    });
    
    this.detailModeContainer.appendChild(contentDiv);
    
    // 添加按钮容器
    const buttonContainer = document.createElement("div");
    buttonContainer.className = "edit-actions";
    
    // 取消按钮
    const cancelButton = document.createElement("button");
    cancelButton.textContent = "取消";
    cancelButton.className = "cancel-button";
    cancelButton.addEventListener("click", this.handleCancel);
    
    // 保存按钮
    const saveButton = document.createElement("button");
    saveButton.textContent = "保存";
    saveButton.className = "save-button";
    saveButton.addEventListener("click", this.handleSave);
    
    buttonContainer.appendChild(cancelButton);
    buttonContainer.appendChild(saveButton);
    
    this.detailModeContainer.appendChild(buttonContainer);
  }

  /**
   * 显示详细编辑模式
   */
  private showDetailMode = (event: MouseEvent): void => {
    // 阻止事件冒泡，以免触发表格的其他事件
    event.stopPropagation();
    
    this.isDetailMode = true;
    
    // 先渲染详细模式内容
    this.detailModeContainer.innerHTML = '';
    this.renderDetailMode();
    
    // 计算并设置详细模式位置
    this.positionDetailMode();
    
    // 显示详细模式容器
    this.detailModeContainer.style.display = "block";
    
    // 添加全局点击事件，用于处理点击外部区域关闭详细模式
    setTimeout(() => {
      document.addEventListener('click', this.handleOutsideClick);
    }, 0);
  }
  
  /**
   * 处理点击外部区域关闭详细模式
   */
  private handleOutsideClick = (event: MouseEvent): void => {
    // 检查点击是否在详细模式容器外部
    if (!this.detailModeContainer.contains(event.target as Node) && 
        this.isDetailMode) {
      this.returnToSimpleMode();
      document.removeEventListener('click', this.handleOutsideClick);
    }
  }
  
  /**
   * 计算并设置详细编辑模式的位置
   */
  private positionDetailMode(): void {
    // 获取简单模式容器的位置
    const simpleModeRect = this.simpleModeContainer.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    
    // 设置详细模式的样式和位置，使其显示在简单模式下方
    this.detailModeContainer.style.position = "absolute";
    this.detailModeContainer.style.top = `${simpleModeRect.bottom + scrollTop + 2}px`;
    this.detailModeContainer.style.left = `${simpleModeRect.left + scrollLeft}px`;
    this.detailModeContainer.style.minWidth = `${Math.max(simpleModeRect.width, 250)}px`;
    this.detailModeContainer.style.zIndex = "1000";
    
    // 确保详细模式容器在DOM中
    if (!document.body.contains(this.detailModeContainer)) {
      document.body.appendChild(this.detailModeContainer);
    }
  }

  /**
   * 返回到简单模式
   */
  private returnToSimpleMode = (): void => {
    this.isDetailMode = false;
    this.detailModeContainer.style.display = "none";
    
    // 从DOM中移除详细模式容器
    if (document.body.contains(this.detailModeContainer)) {
      document.body.removeChild(this.detailModeContainer);
    }
    
    // 移除全局点击事件
    document.removeEventListener('click', this.handleOutsideClick);
    
    // 重新渲染简单模式
    this.simpleModeContainer.innerHTML = '';
    this.renderSimpleMode();
    
    this.simpleModeContainer.style.display = "block";
  }

  private handleCancel = (): void => {
    console.log("[TagEdit] cancel clicked");
    this.returnToSimpleMode();
  };
  
  private handleSave = (): void => {
    console.log("[TagEdit] save clicked");
    const updatedTags: string[] = [];
    this.checkboxes.forEach((cb) => {
      if (cb.checked) {
        updatedTags.push(cb.value);
      }
    });

    // 提交更新后的值
    if (this.params.onComplete) {
      // @ts-ignore - 临时忽略类型错误
      this.params.onComplete(updatedTags);
    }
    
    // 返回简单模式
    this.returnToSimpleMode();
  };

  private handleChange = (): void => {
    // 不自动保存，由用户点击保存按钮触发
  };
}

/**
 * 地址视图组件
 * 用于显示地址信息
 */
export class AddressViewComponent implements IComponent {
  private container: HTMLElement;
  private params!: IComponentParams;

  constructor() {
    this.container = document.createElement("div");
    this.container.className = "address-view";
  }

  init(params: IComponentParams): void {
    this.params = params;
    this.render();
  }

  getGui(): HTMLElement {
    return this.container;
  }

  refresh(params: IComponentParams): boolean {
    this.params = params;
    this.container.textContent = '';
    this.render();
    return true;
  }
  
  destroy(): void {
    // 无需额外清理
  }

  private render(): void {
    const address = this.params.value || {};
    const parts = [];

    if (address.street) parts.push(address.street);
    if (address.city) parts.push(address.city);
    if (address.state) parts.push(address.state);
    if (address.zip) parts.push(address.zip);

    this.container.textContent = parts.join(", ");
  }
}

/**
 * 地址编辑组件 - 双阶段编辑
 */
export class AddressEditComponent implements IComponent {
  private container: HTMLElement;
  private simpleModeContainer: HTMLElement;
  private detailModeContainer: HTMLElement;
  private params!: IComponentParams;
  private streetInput!: HTMLInputElement;
  private cityInput!: HTMLInputElement;
  private stateInput!: HTMLInputElement;
  private zipInput!: HTMLInputElement;
  private isDetailMode = false;
  
  // 单例实例
  private static instance: AddressEditComponent | null = null;
  
  // 私有构造函数，防止通过new直接创建
  private constructor() {
    // 创建容器
    this.container = document.createElement("div");
    this.container.className = "address-edit-container";
    
    // 创建简单模式容器
    this.simpleModeContainer = document.createElement("div");
    this.simpleModeContainer.className = "simple-edit-mode";
    this.container.appendChild(this.simpleModeContainer);
    
    // 创建详细模式容器 - 不放在container内，而是独立的
    this.detailModeContainer = document.createElement("div");
    this.detailModeContainer.className = "detail-edit-mode";
    this.detailModeContainer.style.display = "none";
    // 这里不添加到DOM中，而是等到需要显示时添加到body
  }
  
  /**
   * 获取单例实例
   */
  public static getInstance(): AddressEditComponent {
    if (!AddressEditComponent.instance) {
      console.log("[AddressEdit] Creating singleton instance");
      AddressEditComponent.instance = new AddressEditComponent();
    }
    return AddressEditComponent.instance;
  }

  init(params: IComponentParams): void {
    console.log("[AddressEdit] init called");
    this.params = params;
    this.isDetailMode = false;
    
    // 清空并重新渲染
    this.simpleModeContainer.innerHTML = '';
    this.detailModeContainer.innerHTML = '';
    
    // 渲染简单模式视图
    this.renderSimpleMode();
    
    // 设置初始显示状态
    this.simpleModeContainer.style.display = "block";
    this.detailModeContainer.style.display = "none";
    
    // 确保详细模式容器不在DOM中
    if (document.body.contains(this.detailModeContainer)) {
      document.body.removeChild(this.detailModeContainer);
    }
  }

  getGui(): HTMLElement {
    return this.container;
  }

  refresh(params: IComponentParams): boolean {
    console.log("[AddressEdit] refresh called");
    this.params = params;
    
    if (!this.isDetailMode) {
      this.simpleModeContainer.innerHTML = '';
      this.renderSimpleMode();
    } else {
      this.detailModeContainer.innerHTML = '';
      this.renderDetailMode();
      this.positionDetailMode();
    }
    
    return true;
  }

  destroy(): void {
    console.log("[AddressEdit] destroy called");
    
    // 移除详细模式容器，如果它在DOM中
    if (document.body.contains(this.detailModeContainer)) {
      document.body.removeChild(this.detailModeContainer);
    }
    
    // 移除全局点击事件
    document.removeEventListener('click', this.handleOutsideClick);
  }
  
  /**
   * 渲染简单模式UI
   */
  private renderSimpleMode(): void {
    const address = this.params.value || {};
    
    // 创建简单编辑框
    const editBox = document.createElement("div");
    editBox.className = "simple-edit-box";
    
    const editText = document.createElement("span");
    const hasAddress = address.street || address.city || address.state || address.zip;
    editText.textContent = hasAddress ? 
      `${address.street || ''}, ${address.city || ''}...` : 
      "点击编辑地址";
    editBox.appendChild(editText);
    
    const editButton = document.createElement("button");
    editButton.className = "simple-edit-button";
    editButton.textContent = "编辑";
    editButton.addEventListener("click", this.showDetailMode);
    
    editBox.appendChild(editButton);
    this.simpleModeContainer.appendChild(editBox);
  }

  /**
   * 渲染详细编辑模式UI
   */
  private renderDetailMode(): void {
    const address = this.params.value || {};
    
    // 添加标题
    const titleDiv = document.createElement("div");
    titleDiv.className = "edit-title";
    titleDiv.textContent = "编辑地址";
    this.detailModeContainer.appendChild(titleDiv);
    
    // 添加内容容器
    const contentDiv = document.createElement("div");
    contentDiv.className = "edit-content";

    // 街道字段
    const streetField = document.createElement("div");
    streetField.className = "address-field";

    const streetLabel = document.createElement("label");
    streetLabel.textContent = "街道";

    this.streetInput = document.createElement("input");
    this.streetInput.type = "text";
    this.streetInput.value = address.street || "";

    streetField.appendChild(streetLabel);
    streetField.appendChild(this.streetInput);
    contentDiv.appendChild(streetField);

    // 城市字段
    const cityField = document.createElement("div");
    cityField.className = "address-field";

    const cityLabel = document.createElement("label");
    cityLabel.textContent = "城市";

    this.cityInput = document.createElement("input");
    this.cityInput.type = "text";
    this.cityInput.value = address.city || "";

    cityField.appendChild(cityLabel);
    cityField.appendChild(this.cityInput);
    contentDiv.appendChild(cityField);

    // 州/省字段
    const stateField = document.createElement("div");
    stateField.className = "address-field";

    const stateLabel = document.createElement("label");
    stateLabel.textContent = "州/省";

    this.stateInput = document.createElement("input");
    this.stateInput.type = "text";
    this.stateInput.value = address.state || "";

    stateField.appendChild(stateLabel);
    stateField.appendChild(this.stateInput);
    contentDiv.appendChild(stateField);

    // 邮编字段
    const zipField = document.createElement("div");
    zipField.className = "address-field";

    const zipLabel = document.createElement("label");
    zipLabel.textContent = "邮编";

    this.zipInput = document.createElement("input");
    this.zipInput.type = "text";
    this.zipInput.value = address.zip || "";

    zipField.appendChild(zipLabel);
    zipField.appendChild(this.zipInput);
    contentDiv.appendChild(zipField);
    
    this.detailModeContainer.appendChild(contentDiv);

    // 按钮容器
    const buttonContainer = document.createElement("div");
    buttonContainer.className = "edit-actions";

    const cancelButton = document.createElement("button");
    cancelButton.textContent = "取消";
    cancelButton.className = "cancel-button";
    cancelButton.addEventListener("click", this.handleCancel);

    const saveButton = document.createElement("button");
    saveButton.textContent = "保存";
    saveButton.className = "save-button";
    saveButton.addEventListener("click", this.handleSave);

    buttonContainer.appendChild(cancelButton);
    buttonContainer.appendChild(saveButton);
    
    this.detailModeContainer.appendChild(buttonContainer);
  }

  /**
   * 显示详细编辑模式
   */
  private showDetailMode = (event: MouseEvent): void => {
    // 阻止事件冒泡，以免触发表格的其他事件
    event.stopPropagation();
    
    this.isDetailMode = true;
    
    // 先渲染详细模式内容
    this.detailModeContainer.innerHTML = '';
    this.renderDetailMode();
    
    // 计算并设置详细模式位置
    this.positionDetailMode();
    
    // 显示详细模式容器
    this.detailModeContainer.style.display = "block";
    
    // 添加全局点击事件，用于处理点击外部区域关闭详细模式
    setTimeout(() => {
      document.addEventListener('click', this.handleOutsideClick);
    }, 0);
    
    // 聚焦第一个输入框
    setTimeout(() => {
      if (this.streetInput) {
        this.streetInput.focus();
      }
    }, 10);
  }
  
  /**
   * 处理点击外部区域关闭详细模式
   */
  private handleOutsideClick = (event: MouseEvent): void => {
    // 检查点击是否在详细模式容器外部
    if (!this.detailModeContainer.contains(event.target as Node) && 
        this.isDetailMode) {
      this.returnToSimpleMode();
      document.removeEventListener('click', this.handleOutsideClick);
    }
  }
  
  /**
   * 计算并设置详细编辑模式的位置
   */
  private positionDetailMode(): void {
    // 获取简单模式容器的位置
    const simpleModeRect = this.simpleModeContainer.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    
    // 设置详细模式的样式和位置，使其显示在简单模式下方
    this.detailModeContainer.style.position = "absolute";
    this.detailModeContainer.style.top = `${simpleModeRect.bottom + scrollTop + 2}px`;
    this.detailModeContainer.style.left = `${simpleModeRect.left + scrollLeft}px`;
    this.detailModeContainer.style.minWidth = `${Math.max(simpleModeRect.width, 250)}px`;
    this.detailModeContainer.style.zIndex = "1000";
    
    // 确保详细模式容器在DOM中
    if (!document.body.contains(this.detailModeContainer)) {
      document.body.appendChild(this.detailModeContainer);
    }
  }

  /**
   * 返回到简单模式
   */
  private returnToSimpleMode = (): void => {
    this.isDetailMode = false;
    this.detailModeContainer.style.display = "none";
    
    // 从DOM中移除详细模式容器
    if (document.body.contains(this.detailModeContainer)) {
      document.body.removeChild(this.detailModeContainer);
    }
    
    // 移除全局点击事件
    document.removeEventListener('click', this.handleOutsideClick);
    
    // 重新渲染简单模式
    this.simpleModeContainer.innerHTML = '';
    this.renderSimpleMode();
    
    this.simpleModeContainer.style.display = "block";
  }

  private handleCancel = (): void => {
    console.log("[AddressEdit] cancel clicked");
    this.returnToSimpleMode();
  };

  private handleSave = (): void => {
    console.log("[AddressEdit] save clicked");
    const updatedAddress: AddressValue = {
      street: this.streetInput.value,
      city: this.cityInput.value,
      state: this.stateInput.value,
      zip: this.zipInput.value,
    };

    if (this.params.onComplete) {
      // @ts-ignore - 临时忽略类型错误
      this.params.onComplete(updatedAddress);
    }
    
    // 返回简单模式
    this.returnToSimpleMode();
  };
}

// 导出单例获取方法，用于组件注册
export { TagEditComponent as TagEditComponentClass };
export { AddressEditComponent as AddressEditComponentClass };