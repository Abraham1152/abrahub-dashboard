import { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '@/stores/authStore'
import { useTheme } from '@/stores/themeStore'
import {
  Home,
  Kanban,
  FileText,
  Target,
  LogOut,
  Menu,
  Youtube,
  Wallet,
  Receipt,
  Bot,
  Megaphone,
  MessageCircle,
  Mail,
  Sun,
  Moon,
  ChevronLeft,
} from 'lucide-react'
import { useState } from 'react'

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const navItems = [
    { label: 'Centro de Comando', icon: Home, path: '/' },
    { label: 'Financeiro', icon: Wallet, path: '/financeiro' },
    { label: 'Gastos', icon: Receipt, path: '/gastos' },
    { label: 'YouTube', icon: Youtube, path: '/social' },
    { label: 'Insta Ninja', icon: Bot, path: '/insta-ninja' },
    { label: 'Ads Manager', icon: Megaphone, path: '/ads' },
    { label: 'Human Agent', icon: MessageCircle, path: '/human-agent' },
    { label: 'Agente E-mails', icon: Mail, path: '/email-agent' },
    { label: 'Board', icon: Kanban, path: '/kanban' },
    { label: 'Log Estrategico', icon: FileText, path: '/decisions' },
    { label: 'OKRs', icon: Target, path: '/okrs' },
  ]

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-950 transition-colors">
      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-full z-30 bg-white dark:bg-neutral-900 border-r border-gray-100 dark:border-neutral-800 transition-all duration-300 ${
          sidebarOpen ? 'w-64' : 'w-20'
        }`}
      >
        {/* Logo + Collapse */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-gray-100 dark:border-neutral-800">
          <div className={`flex items-center gap-2 ${!sidebarOpen && 'justify-center w-full'}`}>
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
              A
            </div>
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
              Menu
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
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-600 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors mb-1"
            title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            {sidebarOpen && (theme === 'dark' ? 'Modo Claro' : 'Modo Escuro')}
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
                    {user?.role === 'admin' ? 'Admin' : 'Socio'}
                  </p>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={() => signOut()}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
            title="Sair"
          >
            <LogOut size={18} />
            {sidebarOpen && 'Sair'}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-20'}`}>
        {/* Header */}
        <header className="h-16 bg-white dark:bg-neutral-900 border-b border-gray-100 dark:border-neutral-800 flex items-center justify-between px-6 sticky top-0 z-20">
          <div className="flex items-center gap-4">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-xl transition-colors text-gray-500 dark:text-neutral-400"
                title="Abrir menu"
              >
                <Menu size={20} />
              </button>
            )}
          </div>

          {/* Header right */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400 dark:text-neutral-500">
              {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </span>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-6">{children}</div>
      </main>
    </div>
  )
}
