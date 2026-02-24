import { useLanguage } from '@/stores/languageStore'
import pt from './pt.json'
import en from './en.json'

const translations: Record<string, Record<string, unknown>> = { pt, en }

function getNestedValue(obj: Record<string, unknown>, path: string): string | undefined {
  const keys = path.split('.')
  let current: unknown = obj
  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[key]
  }
  return typeof current === 'string' ? current : undefined
}

export function useTranslation() {
  const lang = useLanguage((s) => s.lang)
  const dict = translations[lang] || translations.pt

  function t(key: string, vars?: Record<string, string | number>): string {
    let value = getNestedValue(dict as Record<string, unknown>, key)
    if (!value) value = getNestedValue(translations.pt as Record<string, unknown>, key)
    if (!value) return key

    if (vars) {
      Object.entries(vars).forEach(([k, v]) => {
        value = value!.replace(`{${k}}`, String(v))
      })
    }
    return value
  }

  return { t, lang }
}
