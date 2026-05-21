import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MantineProvider, createTheme } from '@mantine/core'
import '@mantine/core/styles.css'
import 'maplibre-gl/dist/maplibre-gl.css'
import './index.css'
import App from './App.jsx'

const theme = createTheme({
  colorScheme: 'dark',
  colors: {
    brand: [
      '#e7f2ff',
      '#cfe4ff',
      '#9ec9ff',
      '#6cadff',
      '#3b92ff',
      '#006cd7',
      '#005fc0',
      '#0052a9',
      '#004592',
      '#00387b',
    ],
  },
  primaryColor: 'brand',
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <App />
    </MantineProvider>
  </StrictMode>
)
