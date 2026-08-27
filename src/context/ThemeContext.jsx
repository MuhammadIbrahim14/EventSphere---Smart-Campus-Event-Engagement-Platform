import { createContext, useContext } from 'react'

const ThemeContext = createContext(null)

export function ThemeProvider({ value, children }) {
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  return ctx || { theme: 'dark', setTheme: () => {} }
}
