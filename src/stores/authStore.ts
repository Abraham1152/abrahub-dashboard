import { create } from 'zustand'
import { supabase } from '@/integrations/supabase'

type User = {
  id: string
  email: string
  role: 'admin' | 'partner'
  full_name: string | null
}

type AuthStore = {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, fullName: string) => Promise<void>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  checkAuth: () => Promise<void>
}

export const useAuth = create<AuthStore>((set) => ({
  user: null,
  loading: true,

  checkAuth: async () => {
    try {
      const { data } = await supabase.auth.getSession()
      if (data.session?.user) {
        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .eq('id', data.session.user.id)
          .single()

        if (userData) {
          set({ user: userData as User })
        }
      }
    } catch (error) {
      console.error('Auth check error:', error)
    } finally {
      set({ loading: false })
    }
  },

  signIn: async (email: string, password: string) => {
    set({ loading: true })
    try {
      const { error, data } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error

      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', data.user.id)
        .single()

      if (userData) {
        set({ user: userData as User })
      }
    } finally {
      set({ loading: false })
    }
  },

  signUp: async (email: string, password: string, fullName: string) => {
    set({ loading: true })
    try {
      const { error, data } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
        },
      })
      if (error) throw error

      // Create user record
      await supabase.from('users').insert({
        id: data.user!.id,
        email,
        full_name: fullName,
        role: 'partner',
      })
    } finally {
      set({ loading: false })
    }
  },

  signOut: async () => {
    set({ loading: true })
    try {
      await supabase.auth.signOut()
      set({ user: null })
    } finally {
      set({ loading: false })
    }
  },

  resetPassword: async (email: string) => {
    await supabase.auth.resetPasswordForEmail(email)
  },
}))
