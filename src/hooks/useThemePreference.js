import { useEffect, useState } from 'react'

export function useThemePreference({ getSystemTheme, themePreference }) {
  const [systemTheme, setSystemTheme] = useState(getSystemTheme)
  const effectiveTheme = themePreference === 'system' ? systemTheme : themePreference

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const updateSystemTheme = (event) => {
      setSystemTheme(event.matches ? 'dark' : 'light')
    }

    media.addEventListener('change', updateSystemTheme)
    return () => media.removeEventListener('change', updateSystemTheme)
  }, [])

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', effectiveTheme === 'dark')
    root.style.colorScheme = effectiveTheme === 'dark' ? 'dark' : 'light'
  }, [effectiveTheme])

  return {
    effectiveTheme,
    systemTheme,
  }
}
