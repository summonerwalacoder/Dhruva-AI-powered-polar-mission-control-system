import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useMission } from '../context/MissionContext'
import { ROLE_NAMES, can } from '../lib/perms'
import { useConnectivity, type ConnMode } from '../lib/connectivity'
import { t, type Lang } from '../lib/i18n'
import { navForRole, roleConfig, type NavEntry } from '../lib/roleConfig'
import { cx, Icon } from './ui'
import { AssistantFab } from './AIAssistant'
import { EmergencyFab } from './EmergencyFab'

export function Layout() {
  const { user, logout } = useAuth()
  const { missions, selectedId, setSelected } = useMission()
  const loc = useLocation()
  const [menu, setMenu] = useState(false)
  const conn = useConnectivity()
  const [lang] = useState<Lang>((user?.language as Lang) || 'en')

  const role = user?.role || ''
  const cfg = roleConfig(role)
  const theme = cfg?.theme
  const visible = navForRole(role)
  const showMissionBar = !!cfg?.missionSelector && can(role, 'mission:read')

  useEffect(() => {
    setMenu(false)
  }, [loc.pathname])

  return (
    <div className="flex min-h-full flex-col lg:flex-row">
      {/* Sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-ink-700/50 bg-ink-900/60 backdrop-blur lg:flex">
        <Brand theme={theme?.text} />
        <div className="mx-3 mb-2 rounded-lg border border-ink-700/60 bg-ink-800/50 px-3 py-2">
          <div className={cx('text-[11px] font-semibold uppercase tracking-wide', theme?.text)}>{cfg?.context}</div>
          <div className="truncate text-[10px] text-slate-500">{ROLE_NAMES[role] || role}</div>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
          {visible.map((e) => (
            <SideLink key={e.to} e={e} lang={lang} activeCls={theme?.active} />
          ))}
        </nav>
        <div className="border-t border-ink-700/50 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <span className={cx('h-2 w-2 rounded-full', connDot(conn.mode))} />
            <span className={cx('text-xs font-medium', connLabelCls(conn.mode))}>{connLabel(conn.mode)}</span>
            {conn.lastSync ? (
              <span className="text-[10px] text-slate-500">sync {new Date(conn.lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            ) : null}
            {conn.pending ? (
              <span className="ml-1 rounded bg-ice-500/20 px-1.5 py-0.5 text-[10px] text-ice-300">↻ {conn.pending} pending</span>
            ) : null}
            {conn.pending || conn.mode !== 'online' ? (
              <button
                onClick={() => conn.flush()}
                disabled={conn.mode === 'syncing' || conn.mode === 'offline'}
                className="ml-auto rounded bg-ink-700 px-1.5 py-0.5 text-[10px] text-slate-200 hover:bg-ink-600 disabled:opacity-50"
              >
                sync now
              </button>
            ) : null}
          </div>
          <div className="mb-3 rounded-lg bg-ink-800/60 p-2.5">
            <div className="truncate text-sm font-medium text-slate-200">{user?.name}</div>
            <div className="truncate text-[11px] text-slate-400">{ROLE_NAMES[role] || role}</div>
          </div>
          <button
            onClick={logout}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-slate-300 hover:bg-ink-800"
          >
            <Icon name="power" size={15} /> {t('logout', lang)}
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-ink-700/50 bg-ink-900/90 px-3 py-2 backdrop-blur lg:hidden">
        <button onClick={() => setMenu(true)} className="rounded-lg p-1.5 text-slate-200 hover:bg-ink-800">
          <Icon name="menu" />
        </button>
        <Brand compact theme={theme?.text} />
        <div className="ml-auto flex items-center gap-1">
          <span className={cx('h-2 w-2 rounded-full', connDot(conn.mode))} />
          {conn.pending ? <span className="rounded bg-ice-500/20 px-1 text-[10px] text-ice-300">{conn.pending}</span> : null}
          <button onClick={logout} className="rounded-lg p-1.5 text-slate-300 hover:bg-ink-800">
            <Icon name="power" size={16} />
          </button>
        </div>
      </header>

      {/* Mobile drawer */}
      {menu ? (
        <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setMenu(false)}>
          <div className="h-full w-72 border-r border-ink-700 bg-ink-900 p-3" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between px-1">
              <Brand />
              <button onClick={() => setMenu(false)} className="rounded-lg p-1 text-slate-300 hover:bg-ink-800">
                <Icon name="x" size={18} />
              </button>
            </div>
            <div className="mb-2 rounded-lg border border-ink-700/60 bg-ink-800/50 px-3 py-2">
              <div className={cx('text-[11px] font-semibold uppercase tracking-wide', theme?.text)}>{cfg?.context}</div>
            </div>
            <nav className="space-y-0.5">
              {visible.map((e) => (
                <SideLink key={e.to} e={e} lang={lang} activeCls={theme?.active} />
              ))}
            </nav>
            <div className="mt-4 border-t border-ink-700/50 p-2 text-sm text-slate-300">
              <div>{user?.name}</div>
              <div className="text-[11px] text-slate-400">{ROLE_NAMES[role] || role}</div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Main */}
      <main className="flex-1 overflow-x-hidden pb-24 lg:pb-6">
        {conn.mode === 'offline' ? (
          <div className="flex flex-wrap items-center gap-2 border-b border-rose-500/30 bg-rose-500/10 px-4 py-1.5 text-xs text-rose-200">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
            <b>OFFLINE MODE</b>
            <span>— showing cached data · edits are queued locally and sync automatically</span>
            {conn.pending ? <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px]">{conn.pending} pending</span> : null}
            <button
              onClick={() => conn.flush()}
              className="ml-auto rounded bg-rose-500/25 px-2 py-0.5 hover:bg-rose-500/40"
            >
              retry sync
            </button>
          </div>
        ) : conn.mode === 'weak' ? (
          <div className="border-b border-amber-500/25 bg-amber-500/10 px-4 py-1 text-[11px] text-amber-200">
            <b>WEAK SIGNAL</b> — using cached data · auto-sync when connection improves
          </div>
        ) : conn.mode === 'syncing' ? (
          <div className="border-b border-ice-500/20 bg-ice-500/10 px-4 py-1 text-[11px] text-ice-200">
            <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-ice-400" />
            Syncing offline changes…
          </div>
        ) : null}
        {showMissionBar && missions.length ? (
          <div className="flex flex-wrap items-center gap-2 border-b border-ink-700/40 px-4 py-2">
            <span className="text-[11px] uppercase tracking-wide text-slate-400">Mission</span>
            <select
              value={selectedId || ''}
              onChange={(e) => setSelected(Number(e.target.value))}
              className="rounded-lg border border-ink-700 bg-ink-800 px-2.5 py-1.5 text-sm text-slate-100 outline-none focus:border-ice-500"
            >
              {missions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.mission_id} · {m.name} ({m.risk_level})
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div className="mx-auto max-w-6xl px-3 py-4 sm:px-5">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 flex justify-around border-t border-ink-700/50 bg-ink-900/95 px-1 py-1.5 backdrop-blur lg:hidden">
        {visible.slice(0, 5).map((e) => (
          <NavLink
            key={e.to}
            to={e.to}
            className={({ isActive }) =>
              cx(
                'flex flex-col items-center gap-0.5 rounded-lg px-2 py-1 text-[10px]',
                isActive ? (theme?.text || 'text-ice-300') : 'text-slate-400',
              )
            }
          >
            <Icon name={e.icon} size={18} />
            {t(e.key, lang)}
          </NavLink>
        ))}
      </nav>

      <EmergencyFab />
      <AssistantFab />
    </div>
  )
}

function connDot(mode: ConnMode): string {
  switch (mode) {
    case 'online':
      return 'bg-emerald-400'
    case 'weak':
      return 'bg-amber-400'
    case 'syncing':
      return 'bg-ice-400 animate-pulse'
    default:
      return 'bg-rose-400'
  }
}

function connLabel(mode: ConnMode): string {
  switch (mode) {
    case 'online':
      return 'ONLINE'
    case 'weak':
      return 'WEAK'
    case 'syncing':
      return 'SYNCING…'
    default:
      return 'OFFLINE'
  }
}

function connLabelCls(mode: ConnMode): string {
  switch (mode) {
    case 'online':
      return 'text-emerald-300'
    case 'weak':
      return 'text-amber-300'
    case 'syncing':
      return 'text-ice-300'
    default:
      return 'text-rose-300'
  }
}

function Brand({ compact, theme }: { compact?: boolean; theme?: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-4">
      <div className={cx('flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br text-sm font-black text-ink-950', theme || 'from-ice-400 to-ice-600')}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2 8 20c2 1.5 4 1.5 6 0L12 2z" />
          <circle cx="12" cy="12" r="2" fill="#060d16" />
        </svg>
      </div>
      <div className={compact ? 'flex items-center gap-2' : ''}>
        <div className="text-base font-black tracking-wide text-slate-50">
          DH<span className="text-ice-300">RUVA</span>
        </div>
        {!compact ? <div className="text-[10px] uppercase tracking-wider text-slate-400">Polar Mission Control</div> : null}
      </div>
    </div>
  )
}

function SideLink({ e, lang, activeCls }: { e: NavEntry; lang: Lang; activeCls?: string }) {
  return (
    <NavLink
      to={e.to}
      end={e.to === '/'}
      className={({ isActive }) =>
        cx(
          'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
          isActive ? activeCls || 'bg-ice-500/15 text-ice-200' : 'text-slate-300 hover:bg-ink-800 hover:text-slate-100',
        )
      }
    >
      <Icon name={e.icon} size={17} />
      {t(e.key, lang)}
    </NavLink>
  )
}

// expose for global use (e.g., assistant widget)
export function useNavigator() {
  const nav = useNavigate()
  return nav
}