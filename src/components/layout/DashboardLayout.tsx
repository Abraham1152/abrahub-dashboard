import { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '@/stores/authStore'
import { useTheme } from '@/stores/themeStore'
import { useLanguage } from '@/stores/languageStore'
import { useTranslation } from '@/i18n/useTranslation'
import {
  Home,
  Kanban,
  FileText,
  LogOut,
  Menu,
  Youtube,
  Wallet,
  Receipt,
  Bot,
  Megaphone,
  MessageCircle,
  Mail,
  Users,
  Sun,
  Moon,
  ChevronLeft,
  Bell,
} from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/integrations/supabase'

interface UpcomingMeeting {
  id: string
  title: string
  meeting_date: string
  meeting_time: string
  location?: string
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { toggleLang } = useLanguage()
  const { t, lang } = useTranslation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 1024)
  const [upcomingMeetings, setUpcomingMeetings] = useState<UpcomingMeeting[]>([])
  const [bellOpen, setBellOpen] = useState(false)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 })
  const bellBtnRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on click outside
  useEffect(() => {
    if (!bellOpen) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (bellBtnRef.current?.contains(target)) return
      if (dropdownRef.current?.contains(target)) return
      setBellOpen(false)
    }
    // Use setTimeout to avoid closing on the same click that opened it
    const id = setTimeout(() => document.addEventListener('click', handler), 0)
    return () => {
      clearTimeout(id)
      document.removeEventListener('click', handler)
    }
  }, [bellOpen])

  // Auto-collapse sidebar on small screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) setSidebarOpen(false)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Fetch meetings happening today or tomorrow
  useEffect(() => {
    const checkMeetings = async () => {
      const today = new Date().toISOString().split('T')[0]
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]
      const { data } = await supabase
        .from('meetings')
        .select('id, title, meeting_date, meeting_time, location')
        .in('meeting_date', [today, tomorrow])
        .order('meeting_date')
        .order('meeting_time')
      setUpcomingMeetings((data as UpcomingMeeting[]) || [])
    }
    checkMeetings()
    const interval = setInterval(checkMeetings, 300000)
    return () => clearInterval(interval)
  }, [])

  const toggleBell = () => {
    if (!bellOpen && bellBtnRef.current) {
      const rect = bellBtnRef.current.getBoundingClientRect()
      setDropdownPos({
        top: rect.bottom + 8,
        right: Math.max(8, window.innerWidth - rect.right),
      })
    }
    setBellOpen((prev) => !prev)
  }

  const formatTime = (m: UpcomingMeeting) => {
    const today = new Date().toISOString().split('T')[0]
    const isToday = m.meeting_date === today
    const label = isToday ? t('kanban.today_label') : t('kanban.tomorrow')
    const time = m.meeting_time?.slice(0, 5) || ''
    return `${label} ${lang === 'pt' ? 'as' : 'at'} ${time}`
  }

  const navItems = [
    { label: t('nav.command_center'), icon: Home, path: '/' },
    { label: t('nav.board'), icon: Kanban, path: '/kanban' },
    { label: t('nav.financeiro'), icon: Wallet, path: '/financeiro' },
    { label: t('nav.human_agent'), icon: MessageCircle, path: '/human-agent' },
    { label: t('nav.leads'), icon: Users, path: '/leads' },
    { label: t('nav.insta_ninja'), icon: Bot, path: '/insta-ninja' },
    { label: t('nav.youtube'), icon: Youtube, path: '/social' },
    { label: t('nav.ads_manager'), icon: Megaphone, path: '/ads' },
    { label: t('nav.email_agent'), icon: Mail, path: '/email-agent' },
    { label: t('nav.decisions'), icon: FileText, path: '/decisions' },
    { label: t('nav.expenses'), icon: Receipt, path: '/gastos' },
  ]

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-950 transition-colors">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-full z-30 bg-white dark:bg-neutral-900 border-r border-gray-100 dark:border-neutral-800 transition-all duration-300 ${
          sidebarOpen ? 'w-64' : 'w-0 lg:w-20 overflow-hidden'
        }`}
      >
        {/* Logo + Collapse */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-gray-100 dark:border-neutral-800">
          <div className={`flex items-center gap-2 ${!sidebarOpen && 'justify-center w-full'}`}>
            <img src={`${import.meta.env.BASE_URL}logo.png`} alt="ABRAhub" className="w-8 h-8 rounded-full" />
            {sidebarOpen && (
              <span className="text-lg font-bold text-gray-900 dark:text-white">
                ABRAhub
              </span>
            )}
          </div>
          {sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-400"
            >
              <ChevronLeft size={18} />
            </button>
          )}
        </div>

        {/* Nav Items */}
        <nav className="p-3 space-y-1 mt-2">
          {sidebarOpen && (
            <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-neutral-500">
              {t('nav.menu')}
            </p>
          )}
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400'
                    : 'text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-neutral-800'
                }`
              }
              title={item.label}
            >
              <item.icon size={20} />
              {sidebarOpen && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Bottom Section */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-gray-100 dark:border-neutral-800 p-3">
          {/* Language Toggle */}
          <button
            onClick={toggleLang}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-600 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors mb-1"
            title={lang === 'pt' ? 'Switch to English' : 'Mudar para Português'}
          >
            <span className="text-lg leading-none">{lang === 'pt' ? '🇧🇷' : '🇺🇸'}</span>
            {sidebarOpen && (lang === 'pt' ? 'Português' : 'English')}
          </button>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-600 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors mb-1"
            title={theme === 'dark' ? t('nav.light_mode') : t('nav.dark_mode')}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            {sidebarOpen && (theme === 'dark' ? t('nav.light_mode') : t('nav.dark_mode'))}
          </button>

          {/* User */}
          {sidebarOpen && (
            <div className="px-3 py-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 font-semibold text-xs">
                  {(user?.full_name || user?.email || 'U')[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {user?.full_name || user?.email}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-neutral-500">
                    {user?.role === 'admin' ? t('nav.admin') : t('nav.partner')}
                  </p>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={() => signOut()}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
            title={t('nav.logout')}
          >
            <LogOut size={18} />
            {sidebarOpen && t('nav.logout')}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`transition-all duration-300 ${sidebarOpen ? 'lg:ml-64' : 'lg:ml-20'}`}>
        {/* Header */}
        <header className="h-16 bg-white dark:bg-neutral-900 border-b border-gray-100 dark:border-neutral-800 flex items-center justify-between px-6 sticky top-0 z-20">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className={`p-2 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-xl transition-colors text-gray-500 dark:text-neutral-400 ${sidebarOpen ? 'lg:hidden' : ''}`}
              title={t('nav.open_menu')}
            >
              <Menu size={20} />
            </button>
          </div>

          {/* Header right */}
          <div className="flex items-center gap-3">
            {/* Meeting notification bell */}
            <button
              ref={bellBtnRef}
              onClick={toggleBell}
              className="relative p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
              title={upcomingMeetings.length > 0 ? `${upcomingMeetings.length} ${t('nav.upcoming_meetings')}` : t('nav.no_upcoming')}
            >
              <Bell size={18} className={upcomingMeetings.length > 0 ? 'text-gray-700 dark:text-white' : 'text-gray-400 dark:text-neutral-500'} />
              {upcomingMeetings.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center min-w-[18px] h-[18px] animate-pulse">
                  {upcomingMeetings.length}
                </span>
              )}
            </button>
            <span className="text-xs text-gray-400 dark:text-neutral-500">
              {new Date().toLocaleDateString(lang === 'pt' ? 'pt-BR' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' })}
            </span>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-6">{children}</div>
      </main>

      {/* Bell Dropdown - rendered via portal to escape all stacking contexts */}
      {bellOpen && createPortal(
        <div
          ref={dropdownRef}
          className="w-80 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-xl shadow-2xl overflow-hidden"
          style={{ position: 'fixed', top: dropdownPos.top, right: dropdownPos.right, zIndex: 99999 }}
        >
          <div className="px-4 py-3 border-b border-gray-100 dark:border-neutral-800">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{t('nav.notifications')}</p>
          </div>
          {upcomingMeetings.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-gray-400 dark:text-neutral-500">
              {t('nav.no_upcoming')}
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              {upcomingMeetings.map((m) => {
                const today = new Date().toISOString().split('T')[0]
                const isToday = m.meeting_date === today
                return (
                  <button
                    key={m.id}
                    onClick={() => { setBellOpen(false); navigate('/kanban?tab=agenda') }}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors border-b border-gray-50 dark:border-neutral-800 last:border-0"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${isToday ? 'bg-amber-500' : 'bg-red-500 animate-pulse'}`} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{m.title}</p>
                        <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">
                          {formatTime(m)}
                        </p>
                        {m.location && (
                          <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">{m.location}</p>
                        )}
                      </div>
                      <span className={`ml-auto flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                        isToday
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'
                          : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
                      }`}>
                        {isToday ? t('kanban.today_label') : t('kanban.tomorrow')}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  )
}
