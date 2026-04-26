import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider, ProtectedRoute, LoginPage, SignupPage, OAuthCallbackPage } from './auth'
import Sidebar from './components/Sidebar'
import PromptsPage from './components/PromptsPage'
import PromptRunner from './components/PromptRunner'
import HistoryPage from './components/HistoryPage'
import SchedulesPage from './components/SchedulesPage'
import SettingsPage from './components/SettingsPage'

function AppShell() {
  return (
    <div className="app">
      <Sidebar />
      <div className="app-body">
        <main className="app-main">
          <Routes>
            <Route path="/"                element={<PromptsPage />} />
            <Route path="/prompt/:promptId" element={<PromptRunner />} />
            <Route path="/history"          element={<HistoryPage />} />
            <Route path="/schedules"        element={<SchedulesPage />} />
            <Route path="/settings"         element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login"         element={<LoginPage />} />
          <Route path="/signup"        element={<SignupPage />} />
          <Route path="/auth/callback" element={<OAuthCallbackPage />} />
          <Route path="/*"      element={<ProtectedRoute><AppShell /></ProtectedRoute>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
