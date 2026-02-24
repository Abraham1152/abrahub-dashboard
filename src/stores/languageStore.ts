import { create } from 'zustand'

type Lang = 'pt' | 'en'

interface LanguageState {
  lang: Lang
  setLang: (lang: Lang) => void
  toggleLang: () => void
}

export const useLanguage = create<LanguageState>((set) => ({
  lang: (localStorage.getItem('abrahub-lang') as Lang) || 'pt',
  setLang: (lang) => {
    localStorage.setItem('abrahub-lang', lang)
    set({ lang })
  },
  toggleLang: () =>
    set((state) => {
      const next = state.lang === 'pt' ? 'en' : 'pt'
      localStorage.setItem('abrahub-lang', next)
      return { lang: next }
    }),
}))
