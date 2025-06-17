/**
 * 状态单元格组件 - 显示带颜色的状态标签
 */
export class StatusCellComponent {
  init(params) {
    this.value = params.value;
    this.cellElement = document.createElement('div');
    this.cellElement.className = 'status-cell';

    this.render();
  }

  getGui() {
    return this.cellElement;
  }

  refresh(params) {
    this.value = params.value;
    this.render();
    return true;
  }

  render() {
    // 根据状态值设置不同的样式
    const statusClass = this.value ? `status-${this.value}` : '';
    const statusLabel = this.getStatusLabel(this.value);
    
    this.cellElement.innerHTML = `
      <div class="status-pill ${statusClass}">${statusLabel}</div>
    `;
    
    // 添加样式，确保只添加一次
    if (!document.getElementById('status-cell-styles')) {
      const style = document.createElement('style');
      style.id = 'status-cell-styles';
      style.textContent = `
        .status-cell {
          display: flex;
          align-items: center;
          height: 100%;
          padding: 0 5px;
        }
        .status-pill {
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 12px;
          display: inline-block;
          text-align: center;
          min-width: 60px;
        }
        .status-active {
          background-color: #e6f7ff;
          color: #1890ff;
          border: 1px solid #91d5ff;
        }
        .status-inactive {
          background-color: #f5f5f5;
          color: #999;
          border: 1px solid #d9d9d9;
        }
        .status-pending {
          background-color: #fff7e6;
          color: #fa8c16;
          border: 1px solid #ffd591;
        }
      `;
      document.head.appendChild(style);
    }
  }

  getStatusLabel(status) {
    switch (status) {
      case 'active':
        return '已激活';
      case 'inactive':
        return '未激活';
      case 'pending':
        return '审核中';
      default:
        return status || '未知';
    }
  }

  destroy() {
    // 清理资源
  }
}

/**
 * 按钮单元格组件 - 显示一个可点击的按钮
 */
export class ButtonCellComponent {
  init(params) {
    this.params = params;
    this.data = params.data;
    this.cellElement = document.createElement('div');
    this.cellElement.className = 'button-cell';

    this.render();
  }

  getGui() {
    return this.cellElement;
  }

  render() {
    // 获取按钮文本，默认为"查看"
    const buttonText = this.params.column.cellComponent?.props?.text || '查看';
    
    this.cellElement.innerHTML = `
      <button class="grid-button">${buttonText}</button>
    `;
    
    // 添加点击事件处理
    const button = this.cellElement.querySelector('.grid-button');
    if (button) {
      button.addEventListener('click', this.onClick.bind(this));
    }
    
    // 添加样式，确保只添加一次
    if (!document.getElementById('button-cell-styles')) {
      const style = document.createElement('style');
      style.id = 'button-cell-styles';
      style.textContent = `
        .button-cell {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          padding: 0 5px;
        }
        .grid-button {
          padding: 4px 12px;
          background-color: #1890ff;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          transition: background-color 0.3s;
        }
        .grid-button:hover {
          background-color: #40a9ff;
        }
      `;
      document.head.appendChild(style);
    }
  }

  onClick(event) {
    event.stopPropagation();
    // 显示行数据
    console.log('行数据:', this.data);
    alert(`查看 ${this.data.name} 的详情`);
  }

  refresh(params) {
    this.params = params;
    this.data = params.data;
    return true;
  }

  destroy() {
    // 清理资源
    const button = this.cellElement.querySelector('.grid-button');
    if (button) {
      button.removeEventListener('click', this.onClick);
    }
  }
} 