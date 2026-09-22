import { useEffect, useState } from 'react'
import { api, ApiError } from '../lib/api'

/* ------------------------------------------------------------------ */
/* Fetch hook                                                          */
/* ------------------------------------------------------------------ */
export function useApi<T = any>(path: string | null, opts?: RequestInit & { useCache?: boolean }) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(Boolean(path))
  const [error, setError] = useState<string>('')
  const [tick, setTick] = useState(0)

  const reload = () => setTick((x) => x + 1)
  const setDataDirect = setData

  useEffect(() => {
    if (!path) {
      setData(null)
      setLoading(false)
      setError('')
      return
    }
    let alive = true
    setLoading(true)
    setError('')
    api<T>(path, opts)
      .then((d) => {
        if (alive) setData(d)
      })
      .catch((e: any) => {
        if (alive) setError(e instanceof ApiError ? e.detail : String(e?.message || e))
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, tick])

  // auto-reload navigation resume
  const [visible] = useVisibility()
  useEffect(() => {
    if (visible && path) reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  return { data, setData: setDataDirect, loading, error, reload }
}

export function useVisibility(): [boolean] {
  const [vis, setVis] = useState(document.visibilityState === 'visible')
  useEffect(() => {
    const h = () => setVis(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', h)
    return () => document.removeEventListener('visibilitychange', h)
  }, [])
  return [vis]
}

/* ------------------------------------------------------------------ */
/* Small primitives                                                    */
/* ------------------------------------------------------------------ */
export const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ')

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cx('rounded-xl border border-ink-700/60 bg-ink-900/70 backdrop-blur', className)}>
      {children}
    </div>
  )
}

export function SectionTitle({ title, right, sub }: { title: string; right?: React.ReactNode; sub?: string }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold text-ice-200">{title}</h2>
        {sub ? <p className="text-xs text-slate-400">{sub}</p> : null}
      </div>
      {right}
    </div>
  )
}

export function Stat({
  label,
  value,
  sub,
  tone = 'default',
  icon,
}: {
  label: string
  value: React.ReactNode
  sub?: string
  tone?: 'default' | 'good' | 'warn' | 'bad' | 'ice' | 'slate' | 'green' | 'amber' | 'red' | 'violet'
  icon?: React.ReactNode
}) {
  const toneCls =
    tone === 'good' || tone === 'green'
      ? 'text-emerald-300'
      : tone === 'warn' || tone === 'amber'
        ? 'text-amber-300'
        : tone === 'bad' || tone === 'red'
          ? 'text-rose-300'
          : tone === 'ice'
            ? 'text-ice-300'
            : tone === 'violet'
              ? 'text-violet-300'
              : 'text-slate-100'
  return (
    <Card className="p-3.5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
          <div className={cx('mt-1 text-2xl font-bold tabular-nums', toneCls)}>{value}</div>
          {sub ? <div className="mt-0.5 text-xs text-slate-400">{sub}</div> : null}
        </div>
        {icon ? <div className="text-ice-400">{icon}</div> : null}
      </div>
    </Card>
  )
}

export function Badge({
  tone = 'slate',
  children,
}: {
  tone?: 'slate' | 'green' | 'amber' | 'red' | 'ice' | 'violet'
  children: React.ReactNode
}) {
  const map = {
    slate: 'bg-slate-500/15 text-slate-300 border-slate-400/20',
    green: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/20',
    amber: 'bg-amber-500/15 text-amber-300 border-amber-400/20',
    red: 'bg-rose-500/15 text-rose-300 border-rose-400/20',
    ice: 'bg-ice-500/15 text-ice-300 border-ice-400/20',
    violet: 'bg-violet-500/15 text-violet-300 border-violet-400/20',
  }
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium', map[tone])}>
      {children}
    </span>
  )
}

export const riskTone = (level?: string) => {
  switch ((level || '').toLowerCase()) {
    case 'low':
      return 'green'
    case 'moderate':
      return 'amber'
    case 'high':
      return 'red'
    case 'critical':
      return 'red'
    default:
      return 'slate'
  }
}

export const statusTone = (s?: string) => {
  switch ((s || '').toLowerCase()) {
    case 'active':
    case 'operational':
    case 'healthy':
    case 'available':
    case 'ok':
    case 'resolved':
    case 'delivered':
    case 'fit':
      return 'green'
    case 'planned':
    case 'in_transit':
    case 'transit':
    case 'pending':
    case 'due':
      return 'ice'
    case 'maintenance':
    case 'moderate':
    case 'serious':
      return 'amber'
    case 'failed':
    case 'critical':
    case 'shortage':
    case 'overdue':
    case 'high':
      return 'red'
    default:
      return 'slate'
  }
}

export function Progress({ value, tone = 'ice' }: { value?: number; tone?: 'ice' | 'green' | 'amber' | 'red' }) {
  const bars = { ice: 'bg-ice-400', green: 'bg-emerald-400', amber: 'bg-amber-400', red: 'bg-rose-400' }
  const p = Math.max(0, Math.min(100, value ?? 0))
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-700/70">
      <div className={cx('h-full rounded-full transition-all', bars[tone])} style={{ width: `${p}%` }} />
    </div>
  )
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-slate-400">
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-ice-400 border-t-transparent" />
      {label ? <span className="text-sm">{label}</span> : null}
    </div>
  )
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-200">
      <p>{message}</p>
      {onRetry ? (
        <button onClick={onRetry} className="mt-2 rounded-lg bg-rose-400/20 px-3 py-1 text-xs font-medium hover:bg-rose-400/30">
          Retry
        </button>
      ) : null}
    </div>
  )
}

export function Empty({ label }: { label: string }) {
  return <div className="rounded-xl border border-dashed border-ink-700 p-8 text-center text-sm text-slate-400">{label}</div>
}

export function Flex({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cx('flex items-center gap-2', className)}>{children}</div>
}

export function Btn({
  children,
  onClick,
  kind = 'primary',
  className,
  disabled,
  type,
}: {
  children: React.ReactNode
  onClick?: () => void
  kind?: 'primary' | 'ghost' | 'danger' | 'outline'
  className?: string
  disabled?: boolean
  type?: 'button' | 'submit'
}) {
  const styles = {
    primary: 'bg-ice-500 text-ink-950 hover:bg-ice-400',
    ghost: 'bg-ink-700/60 text-slate-200 hover:bg-ink-700',
    outline: 'border border-ink-700 text-slate-200 hover:bg-ink-800',
    danger: 'bg-rose-500/90 text-white hover:bg-rose-400',
  }
  return (
    <button
      type={type || 'button'}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        styles[kind],
        className,
      )}
    >
      {children}
    </button>
  )
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-300">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] text-slate-500">{hint}</span> : null}
    </label>
  )
}

export const inputCls =
  'w-full rounded-lg border border-ink-700 bg-ink-800/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-ice-500'

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  wide?: boolean
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div
        className={cx(
          'fade-up max-h-[90vh] w-full overflow-y-auto rounded-t-2xl border border-ink-700 bg-ink-900 p-5 shadow-2xl sm:rounded-2xl',
          wide ? 'sm:max-w-2xl' : 'sm:max-w-md',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-ice-200">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-ink-700 hover:text-white">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Icon({ name, size = 18, className }: { name: string; size?: number; className?: string }) {
  const paths: Record<string, React.ReactNode> = {
    dashboard: <><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></>,
    mission: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3" /></>,
    personnel: <><circle cx="9" cy="8" r="3.5" /><path d="M3 20c0-3.3 2.7-5 6-5s6 1.7 6 5" /><path d="M16 5.5a3 3 0 0 1 0 5.5M17 15.5c2 .8 4 2.2 4 4.5" /></>,
    cargo: <><path d="M3 8h18l-1.5 11a2 2 0 0 1-2 1.8h-11A2 2 0 0 1 4.5 19L3 8z" /><path d="M8 8V6a4 4 0 0 1 8 0v2" /><path d="M3 13h18" /></>,
    inventory: <><path d="M4 4h16v4H4z" /><path d="M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8" /><path d="M9 8v1.5a3 3 0 0 0 6 0V8" /></>,
    asset: <><path d="M4 20c0-8 3-14 8-14s8 6 8 14" /><circle cx="12" cy="6" r="2" /></>,
    map: <><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" /><path d="M9 4v14M15 6v14" /></>,
    weather: <><path d="M8 6a5 5 0 0 1 9.5 2.5A4 4 0 0 1 17 16H7a4.5 4.5 0 0 1-2-8.5" /><path d="M12 3v4" /></>,
    alert: <><path d="M12 3l9 16H3l9-16z" /><path d="M12 10v4M12 17v.5" /></>,
    report: <><path d="M5 3h10l4 4v14H5z" /><path d="M15 3v4h4M9 12h6M9 16h6" /></>,
    analytics: <><path d="M4 20V10M10 20V4M16 20v-9M22 20H2" /></>,
    admin: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5" /></>,
    simulate: <><path d="m13 3-8 11h7l-1 7 8-11h-7l1-7z" /></>,
    ai: <><path d="M12 3v3M12 18v3M3 12h3M18 12h3M6 6l2 2M16 16l2 2M6 18l2-2M16 8l2-2" /><circle cx="12" cy="12" r="3" /></>,
    emergency: <><path d="M12 4 20 20H4L12 4z" /><path d="M12 9v5M12 16.5v.5" /></>,
    send: <path d="m22 2-9 9M22 2 15 22l-4-9-9-4 20-7z" />,
    mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M4 11a8 8 0 0 0 16 0M12 19v2" /></>,
    stop: <rect x="6" y="6" width="12" height="12" rx="2" />,
    menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
    chevron: <path d="m9 6 6 6-6 6" />,
    download: <><path d="M12 3v12M7 10l5 5 5-5" /><path d="M4 21h16" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    x: <path d="M18 6 6 18M6 6l12 12" />,
    filter: <path d="M4 6h16M7 12h10M10 18h4" />,
    qr: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3h-3zM20 14v3M14 20h3v-1M20 20h.01" /></>,
    wifi: <><path d="M5 12a10 10 0 0 1 14 0M8.5 15.5a5 5 0 0 1 7 0" /><circle cx="12" cy="19" r=".5" /></>,
    refresh: <><path d="M4 4v6h6M20 20v-6h-6" /><path d="M20 9a8 8 0 0 0-14-3L4 10M4 15a8 8 0 0 0 14 3l2-4" /></>,
    bell: <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6M10 19a2 2 0 0 0 4 0" />,
    power: <><path d="M12 3v8" /><path d="M18.4 6.6a8 8 0 1 1-12.8 0" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" /></>,
    users: <><circle cx="9" cy="8" r="3.5" /><path d="M3 20c0-3.3 2.7-5 6-5s6 1.7 6 5" /><path d="M16 5a3.5 3.5 0 0 1 0 6M18.5 15c1.6.8 2.5 2.2 2.5 5" /></>,
    shield: <><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" /><path d="M9 12l2 2 4-4" /></>,
    key: <><circle cx="8" cy="14" r="4" /><path d="M11 11 20 2M16 6l3 3M14 8l2 2" /></>,
    scan: <><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" /><rect x="9" y="9" width="6" height="6" rx="1" /></>,
    box: <><path d="M3 8l9-4 9 4v8l-9 4-9-4V8z" /><path d="M3 8l9 4 9-4M12 12v8" /></>,
    route: <><circle cx="6" cy="18" r="2.5" /><circle cx="18" cy="6" r="2.5" /><path d="M8.5 18H15a3 3 0 0 0 3-3v-.5" /></>,
    building: <><path d="M4 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16" /><path d="M15 9h4a1 1 0 0 1 1 1v11M2 21h20" /><path d="M8 6h2M8 10h2M8 14h2" /></>,
    monitor: <><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M9 20h6M12 16v4" /><path d="M7 8l3 3-3 3M13 14h4" /></>,
    plug: <><path d="M9 3v5M15 3v5" /><path d="M6 8h12v3a6 6 0 0 1-12 0V8z" /><path d="M12 17v4" /></>,
    heart: <><path d="M12 20S4 14 4 8.5 8 3 12 6c4-3 8 1 8 2.5S12 20 12 20z" /></>,
    check: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 12l3 3 7-7" /></>,
    clip: <><path d="M9 3h6M10 3v4l-7 12a2 2 0 0 0 2 3h14a2 2 0 0 0 2-3L14 7V3" /><path d="M8 14h8" /></>,
    radar: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><path d="M12 12l5-5M12 3v3" /></>,
    chart: <><path d="M3 21h18" /><path d="M5 21v-7M10 21V8M15 21v-4M20 21V4" /></>,
    layers: <><path d="M12 3 2 8l10 5 10-5-10-5z" /><path d="M2 13l10 5 10-5" /><path d="M2 18l10 5 10-5" /></>,
    sos: <><path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z" /><path d="M8.5 12.2h7M12 8.5v7" /></>,
    sliders: <><path d="M4 7h16M4 12h16M4 17h16" /><circle cx="9" cy="7" r="2" /><circle cx="15" cy="12" r="2" /><circle cx="7" cy="17" r="2" /></>,
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {paths[name] || <circle cx="12" cy="12" r="9" />}
    </svg>
  )
}