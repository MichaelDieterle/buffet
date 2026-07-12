import './style.css'
import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

const root = createRoot(document.querySelector<HTMLDivElement>('#app')!)
root.render(
  React.createElement(React.StrictMode, null,
    React.createElement(App)
  )
)
