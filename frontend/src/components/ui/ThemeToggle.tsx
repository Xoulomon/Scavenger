import { Moon, Sun, Monitor } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useTheme, type ThemeName } from '@/context/ThemeProvider'
import { cn } from '@/lib/utils'

interface ThemeToggleProps {
  className?: string
  showLabel?: boolean
}

export function ThemeToggle({ className, showLabel = false }: ThemeToggleProps) {
  const { isDark, isReady, toggleTheme } = useTheme()

  const label = isDark ? 'Switch to light mode' : 'Switch to dark mode'

  return (
    <Button
      type="button"
      variant="outline"
      size={showLabel ? 'sm' : 'icon'}
      className={cn('gap-2 overflow-hidden', className)}
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      disabled={!isReady}
    >
      <span className="relative flex items-center justify-center">
        {/* Sun — visible in dark mode */}
        <Sun
          className={cn(
            'absolute h-4 w-4 transition-all duration-300',
            isDark ? 'rotate-0 scale-100 opacity-100' : 'rotate-90 scale-0 opacity-0'
          )}
          aria-hidden
        />
        {/* Moon — visible in light mode */}
        <Moon
          className={cn(
            'h-4 w-4 transition-all duration-300',
            isDark ? '-rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100'
          )}
          aria-hidden
        />
      </span>
      {showLabel ? <span>{isDark ? 'Light mode' : 'Dark mode'}</span> : null}
    </Button>
  )
}

/** Segmented theme selector for settings panels — shows light / dark / system options */
export function ThemeSelector({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()

  const options: { value: ThemeName; label: string; icon: typeof Sun }[] = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor }
  ]

  return (
    <div
      className={cn('flex items-center gap-1 rounded-lg border bg-muted p-1', className)}
      role="radiogroup"
      aria-label="Theme"
    >
      {options.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          onClick={() => setTheme(value)}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200',
            theme === value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden />
          {label}
        </button>
      ))}
    </div>
  )
}
