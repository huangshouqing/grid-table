import { useEffect, useRef } from 'react'
import { Grid } from '@grid-table/core'
import { StatusCellComponent, ButtonCellComponent } from './CustomComponents'

const GridTable = () => {
  const gridContainerRef = useRef(null)
  const gridInstanceRef = useRef(null)

  useEffect(() => {
    // 确保组件已挂载
    if (!gridContainerRef.current) return

    const data = [
      { id: 1, name: '产品 A', price: 100, status: 'active', quantity: 50 },
      { id: 2, name: '产品 B', price: 150, status: 'inactive', quantity: 30 },
      { id: 3, name: '产品 C', price: 200, status: 'active', quantity: 20 },
      { id: 4, name: '产品 D', price: 80, status: 'pending', quantity: 65 },
      { id: 5, name: '产品 E', price: 300, status: 'active', quantity: 10 },
      { id: 6, name: '产品 F', price: 250, status: 'inactive', quantity: 5 },
      { id: 7, name: '产品 G', price: 120, status: 'pending', quantity: 25 },
      { id: 8, name: '产品 H', price: 180, status: 'active', quantity: 40 },
      { id: 9, name: '产品 I', price: 90, status: 'inactive', quantity: 60 },
      { id: 10, name: '产品 J', price: 350, status: 'active', quantity: 15 }
    ]

    const options = {
      container: gridContainerRef.current,
      rowData: data,
      columns: [
        {
          field: 'id',
          headerName: 'ID',
          width: 100
        },
        {
          field: 'name',
          headerName: '产品名称',
          width: 200,
          sortable: true,
          editable: true
        },
        {
          field: 'price',
          headerName: '价格',
          width: 150,
          sortable: true,
          editable: true,
          fillable: true, // 启用批量填充
          valueFormatter: (params) => `¥${params.value}`
        },
        {
          field: 'quantity',
          headerName: '数量',
          width: 150,
          sortable: true,
          editable: true,
          fillable: true // 启用批量填充
        },
        {
          field: 'status',
          headerName: '状态',
          width: 150,
          sortable: true,
          cellComponent: {
            type: 'status-cell',
            props: {}
          }
        },
        {
          field: 'actions',
          headerName: '操作',
          width: 150,
          cellComponent: {
            type: 'button-cell',
            props: {
              text: '查看详情'
            }
          }
        }
      ]
    }

    // 创建表格实例
    gridInstanceRef.current = new Grid(options)
    
    // 在同一个实例上注册自定义组件
    const componentManager = gridInstanceRef.current.getComponentManager()
    componentManager.registerComponent('status-cell', {
      view: StatusCellComponent,
      edit: StatusCellComponent
    })
    componentManager.registerComponent('button-cell', ButtonCellComponent)
    
    // 渲染表格
    gridInstanceRef.current.render(gridContainerRef.current)
    
    // 组件卸载时清理
    return () => {
      if (gridInstanceRef.current) {
        gridInstanceRef.current.destroy()
        gridInstanceRef.current = null
      }
    }
  }, []) // 空依赖数组表示仅在组件挂载时执行

  return (
    <div style={{ width: '100%', height: '100%' }} ref={gridContainerRef}></div>
  )
}

export default GridTable 