import { useState } from 'react'
import { useAuth } from '@/stores/authStore'
import { useTranslation } from '@/i18n/useTranslation'

export default function AuthPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const { signIn } = useAuth()
  const { t } = useTranslation()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    try {
      await signIn(email, password)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t('auth.error'),
      )
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-950 flex items-center justify-center transition-colors">
      <div className="w-full max-w-md px-4">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/logo.png" alt="ABRAhub" className="w-16 h-16 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">ABRAhub</h1>
          <p className="text-gray-500 dark:text-neutral-400 text-sm">{t('auth.title')}</p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800 rounded-2xl p-8 shadow-card">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
            {t('auth.login')}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="email"
              placeholder={t('auth.email')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full"
              required
            />

            <input
              type="password"
              placeholder={t('auth.password')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full"
              required
            />

            {error && (
              <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400 p-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full font-semibold py-2.5 rounded-xl text-black transition-colors hover:brightness-90" style={{ backgroundColor: '#CCFF00' }}
            >
              {t('auth.enter')}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 dark:text-neutral-600 mt-6">
          {t('auth.rights')}
        </p>
      </div>
    </div>
  )
}
