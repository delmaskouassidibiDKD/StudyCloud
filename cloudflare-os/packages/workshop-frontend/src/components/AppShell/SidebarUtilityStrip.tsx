import { Link, useRouterState } from '@tanstack/react-router'
import { Desktop, Moon, Plug, Sun, Gear } from '@phosphor-icons/react'
import { Tooltip } from '@cloudflare/kumo'
import UserMenu from '../UserMenu'
import { useTheme } from '../../ThemeContext'
import { useAuthenticatedApi } from '../../AuthContext'
import type { ThemeMode } from '../../theme'

const THEME_SEQUENCE: ThemeMode[] = ['system', 'light', 'dark']

function nextThemeMode(mode: ThemeMode): ThemeMode {
  return THEME_SEQUENCE[(THEME_SEQUENCE.indexOf(mode) + 1) % THEME_SEQUENCE.length]
}

function ThemeModeButton() {
  const { themeMode, resolvedThemeMode, setThemeMode } = useTheme()
  const label = themeMode === 'system'
    ? `Thème : système (${resolvedThemeMode === 'dark' ? 'sombre' : 'clair'})`
    : `Thème : ${themeMode === 'dark' ? 'sombre' : 'clair'}`
  const nextMode = nextThemeMode(themeMode)
  const nextModeFr = nextMode === 'system' ? 'système' : nextMode === 'dark' ? 'sombre' : 'clair'

  return (
    <Tooltip
      content={`${label}. Passer en mode ${nextModeFr}.`}
      render={(
        <button
          type="button"
          aria-label={`${label}. Passer en mode ${nextModeFr}.`}
          onClick={() => setThemeMode(nextMode)}
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-kumo-inactive transition-colors hover:bg-kumo-tint hover:text-kumo-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kumo-ring focus-visible:ring-offset-2 focus-visible:ring-offset-kumo-elevated"
        >
          {themeMode === 'system' ? (
            <Desktop size={15} />
          ) : themeMode === 'dark' ? (
            <Moon size={15} />
          ) : (
            <Sun size={15} />
          )}
        </button>
      )}
    />
  )
}

function StripLink({
  to,
  label,
  children,
}: {
  to: '/gatekeepers' | '/admin'
  label: string
  children: React.ReactNode
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const active = pathname === to
  return (
    <Tooltip content={label}>
      <Link
        to={to}
        aria-label={label}
        className={[
          'flex h-8 w-8 items-center justify-center rounded-md transition-colors',
          active
            ? 'bg-kumo-fill text-kumo-brand'
            : 'text-kumo-inactive hover:bg-kumo-tint hover:text-kumo-default',
        ].join(' ')}
      >
        {children}
      </Link>
    </Tooltip>
  )
}

export default function SidebarUtilityStrip({ collapsed = false }: { collapsed?: boolean }) {
  const { isAdmin } = useAuthenticatedApi()

  return (
    <div
      className={[
        'shrink-0 flex items-center gap-1 border-t border-kumo-line bg-kumo-elevated px-3 py-2',
        collapsed ? 'flex-col justify-center gap-2 px-1.5' : '',
      ].join(' ')}
    >
      <StripLink to="/gatekeepers" label="Gardiens d'accès">
        <Plug size={15} />
      </StripLink>
      {isAdmin && (
        <StripLink to="/admin" label="Tableau de bord (Modèles d'IA & Paramètres)">
          <Gear size={15} />
        </StripLink>
      )}
      <div className={collapsed ? 'flex flex-col items-center gap-2' : 'ml-auto flex items-center gap-1'}>
        <ThemeModeButton />
        <UserMenu />
      </div>
    </div>
  )
}
