import React, { createContext, useContext, useEffect, useState } from 'react'
import { Appearance } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

const STORAGE_KEY = 'pti-theme-mode'

const LIGHT_COLORS = {
  surface: '#ffffff',
  surfaceMuted: '#f8fafc',
  borderDefault: '#e2e8f0',
  textPrimary: '#0f172a',
  textSecondary: '#475569',
  textMuted: '#94a3b8',
  accentPrimary: '#1d4ed8',
  accentDanger: '#dc2626',
  dangerBorder: '#fecaca',
  dangerText: '#b91c1c',
  dangerBg: '#fee2e2'
}

const DARK_COLORS = {
  surface: '#1e293b',
  surfaceMuted: '#0f172a',
  borderDefault: '#334155',
  textPrimary: '#f1f5f9',
  textSecondary: '#cbd5e1',
  textMuted: '#64748b',
  accentPrimary: '#3b82f6',
  accentDanger: '#ef4444',
  dangerBorder: '#7f1d1d',
  dangerText: '#fca5a5',
  dangerBg: '#450a0a'
}

const ThemeContext = createContext({ mode: 'light', colors: LIGHT_COLORS, toggleMode: () => {} })

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(Appearance.getColorScheme() === 'dark' ? 'dark' : 'light')

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === 'light' || stored === 'dark') setMode(stored)
    })
  }, [])

  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, mode)
  }, [mode])

  function toggleMode() {
    setMode((prev) => (prev === 'light' ? 'dark' : 'light'))
  }

  const colors = mode === 'dark' ? DARK_COLORS : LIGHT_COLORS

  return (
    <ThemeContext.Provider value={{ mode, colors, toggleMode }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useThemeMode() {
  return useContext(ThemeContext)
}
