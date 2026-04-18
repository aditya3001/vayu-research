import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import PromptList from './components/PromptList'
import PromptRunner from './components/PromptRunner'
import HistoryPage from './components/HistoryPage'
import SchedulesPage from './components/SchedulesPage'
import SettingsPage from './components/SettingsPage'

const CATEGORIES = [
  { id: 'market-intelligence', label: 'Market Intel', icon: '📊' },
  { id: 'fundamental-research', label: 'Fundamental', icon: '🔍' },
  { id: 'quick-tools', label: 'Quick Tools', icon: '⚡' },
  { id: 'visual-design', label: 'Visual Design', icon: '🎨' },
  { id: 'advanced', label: 'Advanced', icon: '🚀' },
]

export default function App() {
  return (
    <BrowserRouter>
      <div style={{ display: 'flex', height: '100vh', background: '#0d0d0d', color: '#fff', fontFamily: 'Inter, sans-serif' }}>
        <Sidebar categories={CATEGORIES} />
        <div style={{ flex: 1, overflow: 'auto' }}>
          <Routes>
            <Route path="/" element={<Navigate to="/category/market-intelligence" replace />} />
            <Route path="/category/:categoryId" element={<PromptList categories={CATEGORIES} />} />
            <Route path="/prompt/:promptId" element={<PromptRunner />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/schedules" element={<SchedulesPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  )
}
