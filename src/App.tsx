import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuth } from '@/stores/authStore'
import AuthPage from '@/pages/Auth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import HomePage from '@/pages/Home'
import KanbanPage from '@/pages/Kanban'
import DecisionsPage from '@/pages/Decisions'
import OKRsPage from '@/pages/OKRs'
import DocumentsPage from '@/pages/Documents'
import SocialMediaPage from '@/pages/SocialMedia'
import FinanceiroPage from '@/pages/Financeiro'
import ExpensesPage from '@/pages/Expenses'
import InstaNinjaPage from '@/pages/InstaNinja'
import AdsManagerPage from '@/pages/AdsManager'
import HumanAgentPage from '@/pages/HumanAgent'
import EmailAgentPage from '@/pages/EmailAgent'
import PrivacyPage from '@/pages/Privacy'

function AuthenticatedApp() {
  return (
    <DashboardLayout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/kanban" element={<KanbanPage />} />
        <Route path="/decisions" element={<DecisionsPage />} />
        <Route path="/okrs" element={<OKRsPage />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/financeiro" element={<FinanceiroPage />} />
        <Route path="/gastos" element={<ExpensesPage />} />
        <Route path="/social" element={<SocialMediaPage />} />
        <Route path="/insta-ninja" element={<InstaNinjaPage />} />
        <Route path="/ads" element={<AdsManagerPage />} />
        <Route path="/human-agent" element={<HumanAgentPage />} />
        <Route path="/email-agent" element={<EmailAgentPage />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </DashboardLayout>
  )
}

function AppRoutes() {
  const { user, loading, checkAuth } = useAuth()

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-neutral-950 flex items-center justify-center transition-colors">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold">A</div>
          <p className="text-gray-400 dark:text-neutral-500 text-sm">Carregando...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="*" element={<AuthPage />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/*" element={<AuthenticatedApp />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AppRoutes />
    </BrowserRouter>
  )
}
