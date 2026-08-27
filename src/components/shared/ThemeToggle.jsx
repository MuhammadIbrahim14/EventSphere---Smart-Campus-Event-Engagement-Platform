import { Moon, Sun } from 'lucide-react'

export default function ThemeToggle({ theme, setTheme, className = '' }) {
  const next = theme === 'dark' ? 'light' : 'dark'
  return (
    <button
      type="button"
      className={`icon-btn theme-toggle ${className}`.trim()}
      onClick={(e) => setTheme?.(next, e)}
      aria-label={`Switch to ${next} mode`}
      data-testid="button-theme"
    >
      {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  )
}
