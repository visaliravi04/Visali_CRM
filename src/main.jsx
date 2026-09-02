import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* BASE_URL mirrors vite.config.js's `base` — "/" locally and on Vercel,
        "/Visali_CRM/" on GitHub Pages — so links stay under the right prefix
        wherever this is deployed. */}
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}><App /></BrowserRouter>
  </React.StrictMode>
)
