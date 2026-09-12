import './csp-runtime'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import '@language-lit/material3-expressive/styles.css'
import '../src/styles/styles.css'
import './forecast.css'

import { McpAppProvider } from '../src/app'
import { ForecastApp } from './ForecastApp'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <McpAppProvider
      appInfo={{ name: 'm3e-forecast', version: '0.1.0' }}
      capabilities={{ availableDisplayModes: ['inline', 'fullscreen', 'pip'] }}
    >
      <ForecastApp />
    </McpAppProvider>
  </StrictMode>,
)
