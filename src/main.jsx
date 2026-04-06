import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './contexts/AuthContext'
import { RoleProvider } from './contexts/RoleContext'
import { AppDataProvider } from './contexts/AppDataContext'
import { ThemeProvider } from './contexts/ThemeContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <RoleProvider>
          <AppDataProvider>
            <ThemeProvider>
              <App />
            </ThemeProvider>
          </AppDataProvider>
        </RoleProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
