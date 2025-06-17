import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// 导入表格组件的样式
import '@grid-table/core/dist/style.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
) 