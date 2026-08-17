import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './flow_podcast_studio'
import { Agentation } from 'agentation'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <Agentation />
  </React.StrictMode>,
)
