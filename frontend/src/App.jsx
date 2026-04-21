import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import PromptsPage from './components/PromptsPage'
import PromptRunner from './components/PromptRunner'
import HistoryPage from './components/HistoryPage'
import SchedulesPage from './components/SchedulesPage'
import SettingsPage from './components/SettingsPage'

export default function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <Navbar />
        <div className="app-body">
          <Routes>
            <Route path="/" element={<PromptsPage />} />
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
