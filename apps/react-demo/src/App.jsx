import { useState } from 'react'
import GridTable from './components/GridTable'
import './App.css'

function App() {
  return (
    <>
      <h1>Grid Table React Demo</h1>
      <div className="grid-container">
        <GridTable />
      </div>
    </>
  )
}

export default App 