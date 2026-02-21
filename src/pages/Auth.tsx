import { useState } from 'react'
import { useAuth } from '@/stores/authStore'

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState('')
  const [isResetPassword, setIsResetPassword] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetSent, setResetSent] = useState(false)

  const { signIn, signUp, resetPassword } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    try {
      if (isResetPassword) {
        await resetPassword(resetEmail)
        setResetSent(true)
        return
      }

      if (isLogin) {
        await signIn(email, password)
      } else {
        await signUp(email, password, fullName)
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Erro ao autenticar',
      )
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-950 flex items-center justify-center transition-colors">
      <div className="w-full max-w-md px-4">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-2xl text-white font-bold text-xl mb-4">
            A
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">ABRAhub</h1>
          <p className="text-gray-500 dark:text-neutral-400 text-sm">Dashboard Estrategico</p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800 rounded-2xl p-8 shadow-card">
          {isResetPassword ? (
            <>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Recuperar Senha</h2>

              {resetSent ? (
                <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 p-4 rounded-xl mb-6 text-sm">
                  Email de recuperacao enviado! Verifique sua caixa de entrada.
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <input
                    type="email"
                    placeholder="Seu email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
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
                    className="w-full bg-blue-600 text-white font-semibold py-2.5 rounded-xl hover:bg-blue-700 transition-colors"
                  >
                    Enviar Email
                  </button>
                </form>
              )}

              <button
                onClick={() => { setIsResetPassword(false); setResetSent(false); setResetEmail('') }}
                className="w-full mt-4 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm"
              >
                Voltar
              </button>
            </>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
                {isLogin ? 'Fazer Login' : 'Criar Conta'}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                {!isLogin && (
                  <input
                    type="text"
                    placeholder="Nome completo"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full"
                    required
                  />
                )}

                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full"
                  required
                />

                <input
                  type="password"
                  placeholder="Senha"
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
                  className="w-full bg-blue-600 text-white font-semibold py-2.5 rounded-xl hover:bg-blue-700 transition-colors"
                >
                  {isLogin ? 'Entrar' : 'Criar Conta'}
                </button>
              </form>

              {isLogin && (
                <button
                  onClick={() => setIsResetPassword(true)}
                  className="w-full mt-3 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm"
                >
                  Esqueceu a senha?
                </button>
              )}

              <div className="mt-6 text-center">
                <p className="text-sm text-gray-500 dark:text-neutral-400 mb-2">
                  {isLogin ? 'Nao tem conta?' : 'Ja tem conta?'}
                </p>
                <button
                  onClick={() => setIsLogin(!isLogin)}
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-semibold"
                >
                  {isLogin ? 'Criar nova' : 'Fazer login'}
                </button>
              </div>
            </>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 dark:text-neutral-600 mt-6">
          2025 ABRAhub. Todos os direitos reservados.
        </p>
      </div>
    </div>
  )
}
