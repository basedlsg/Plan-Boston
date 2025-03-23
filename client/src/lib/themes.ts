import { create } from 'zustand'

type ThemeStore = {
  theme: 'light' | 'dark'
  setTheme: (theme: 'light' | 'dark') => void
}

export const useTheme = create<ThemeStore>((set) => ({
  theme: typeof window !== 'undefined' 
    ? window.localStorage.getItem('theme') as 'light' | 'dark' || 'light'
    : 'light',
  setTheme: (theme) => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    window.localStorage.setItem('theme', theme)
    set({ theme })
  },
}))
