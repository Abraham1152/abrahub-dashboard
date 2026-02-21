import { create } from 'zustand'

type Theme = 'light' | 'dark'

type ThemeStore = {
  theme: Theme
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
}

export const useTheme = create<ThemeStore>((set) => {
  const saved = (typeof window !== 'undefined' ? localStorage.getItem('theme') : null) as Theme | null
  const initial: Theme = saved || 'dark'

  // Apply on load
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dark', initial === 'dark')
  }

  return {
    theme: initial,
    toggleTheme: () =>
      set((state) => {
        const next = state.theme === 'dark' ? 'light' : 'dark'
        localStorage.setItem('theme', next)
        document.documentElement.classList.toggle('dark', next === 'dark')
        return { theme: next }
      }),
    setTheme: (theme) => {
      localStorage.setItem('theme', theme)
      document.documentElement.classList.toggle('dark', theme === 'dark')
      set({ theme })
    },
  }
})
