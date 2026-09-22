import { Link } from 'react-router-dom'
import { fmtNum } from '../../lib/api'
import { Badge, Card, Icon, Progress, SectionTitle, Spinner, Stat, cx, riskTone, statusTone, useApi } from '../../components/ui'
import type { MissionSummary } from '../../lib/types'

export default function HQDashboard() {
  const missions = useApi<MissionSummary[]>('/api/missions')
  const personnel = useApi<any[]>('/api/personnel?limit=100&')
  const emergencies = useApi<any[]>('/api/emergencies?status=open')
  const alerts = useApi<any[]>('/api/alerts?status=active')
  const stations = useApi<any[]>('/api/stations')
  const cargo = useApi<any[]>('/api/cargo?')
  const analytics = useApi<any>('/api/analytics/summary')

  const ms = missions.data || []
  const open = emergencies.data || []
  const actAlerts = alerts.data || []
  const stns = stations.data || []
  const cargoRows = cargo.data || []
  const delayed = cargoRows.filter((c) => c.delayed).length
  const deployed = (personnel.data || []).length

  const riskDist = new Map<string, number>()
  ms.forEach((m) => riskDist.set(m.risk_level, (riskDist.get(m.risk_level) || 0) + 1))

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-50">Multi-Mission Strategic Overview</h1>
          <p className="text-sm text-slate-400">Cross-mission posture across all Indian polar operations</p>
        </div>
        <Link to="/missions" className="rounded-lg border border-ice-400/40 px-3 py-2 text-sm font-medium text-ice-300 hover:bg-ice-400/10">All missions →</Link>
      </div>

      {/* Top KPI band */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Active missions" value={fmtNum(ms.filter((m) => m.status === 'active').length)} sub={`${ms.length} total`} tone="ice" />
        <Stat label="Personnel deployed" value={fmtNum(deployed)} sub="across all expeditions" tone="default" />
        <Stat label="Open emergencies" value={fmtNum(open.length)} sub="live incidents" tone={open.length ? 'warn' : 'good'} />
        <Stat label="Active alerts" value={fmtNum(actAlerts.length)} sub="system-wide" tone={actAlerts.length ? 'warn' : 'good'} />
        <Stat label="Stations online" value={fmtNum(stns.filter((s) => s.active).length)} sub={`${stns.length} total`} tone="default" />
        <Stat label="Delayed cargo" value={fmtNum(delayed)} sub="behind schedule" tone={delayed ? 'bad' : 'good'} />
        <Stat label="Critical risk" value={fmtNum(ms.filter((m) => m.risk_level === 'high' || m.risk_level === 'critical').length)} sub="missions need attention" tone="bad" />
        <Stat label="Avg progress" value={ms.length ? `${Math.round(ms.reduce((s, m) => s + (m.progress || 0), 0) / ms.length)}%` : '—'} sub="mission completion" tone="default" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Posture by mission */}
        <Card className="p-4 lg:col-span-2">
          <SectionTitle title="Mission posture" sub="Risk, progress and supply posture per mission" />
          {missions.loading ? <Spinner /> : null}
          {!missions.loading && !ms.length ? <p className="text-sm text-slate-400">No missions yet.</p> : null}
          <div className="space-y-2.5">
            {ms.map((m) => (
              <div key={m.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-ink-700/50 bg-ink-800/40 px-3.5 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-100">{m.mission_id}</span>
                    <Badge tone={statusTone(m.status)}>{m.status}</Badge>
                    <Badge tone={riskTone(m.risk_level)}>{m.risk_level}</Badge>
                  </div>
                  <div className="mt-1 truncate text-xs text-slate-400">{m.name} → {m.destination}</div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="w-44"><Progress value={m.progress || 0} tone={riskTone(m.risk_level) === 'red' ? 'red' : riskTone(m.risk_level) === 'amber' ? 'amber' : 'ice'} /></div>
                    <span className="text-xs tabular-nums text-slate-400">{m.progress || 0}% · day {m.elapsed_days}/{m.total_days}</span>
                  </div>
                </div>
                <Link to={`/missions/${m.id}`} className="rounded-lg px-2.5 py-1.5 text-sm text-ice-300 hover:bg-ink-700">detail →</Link>
              </div>
            ))}
          </div>
        </Card>

        {/* Risk distribution + stations */}
        <div className="space-y-4">
          <Card className="p-4">
            <SectionTitle title="Risk distribution" sub="across active missions" />
            {riskDist.size ? (
              <BarList data={Array.from(riskDist.entries())} />
            ) : (
              <p className="text-sm text-slate-400">No missions to distribute.</p>
            )}
          </Card>
          <Card className="p-4">
            <SectionTitle title="Stations" sub="polar infrastructure" right={<Link to="/stations" className="text-xs text-ice-300">view all</Link>} />
            <div className="space-y-1.5">
              {stns.slice(0, 6).map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-lg bg-ink-800/50 px-2.5 py-1.5 text-sm">
                  <span className="text-slate-300">{s.code} · {s.name}</span>
                  <Badge tone={s.active ? 'green' : 'slate'}>{s.active ? 'online' : 'offline'}</Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Emergencies + alerts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <SectionTitle title="Live emergencies" sub="across all missions" right={<Link to="/emergency" className="text-xs text-ice-300">respond</Link>} />
          {!open.length ? <p className="text-sm text-slate-400">No open emergencies. All sectors stable.</p> : null}
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {open.slice(0, 10).map((e) => (
              <div key={e.id} className="flex items-start gap-2 rounded-lg bg-ink-800/50 px-2.5 py-2 text-sm">
                <Badge tone={statusTone(e.severity)}>{e.severity}</Badge>
                <div className="min-w-0">
                  <div className="truncate font-medium text-slate-200">{e.type} · {e.emergency_id}</div>
                  <div className="truncate text-xs text-slate-400">{e.location} — {(e.description || '').slice(0, 60)}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-4">
          <SectionTitle title="System-wide alerts" sub="aggregated" right={<Link to="/alerts" className="text-xs text-ice-300">all alerts</Link>} />
          {!actAlerts.length ? <p className="text-sm text-slate-400">All clear.</p> : null}
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {actAlerts.slice(0, 10).map((a) => (
              <div key={a.id} className="flex items-center gap-2 rounded-lg bg-ink-800/50 px-2.5 py-2 text-sm">
                <Icon name="alert" size={14} className="text-amber-300" />
                <span className="text-slate-300">{a.title}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Analytics hint */}
      {analytics.data ? (
        <Card className="p-4">
          <SectionTitle title="Analytics snapshot" sub="consumption & predictions" right={<Link to="/analytics" className="text-xs text-ice-300">open analytics</Link>} />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 text-center">
            <MiniStat label="Consumption" value={(analytics.data as any).total_consumption != null ? fmtNum((analytics.data as any).total_consumption) : '—'} />
            <MiniStat label="Shortages" value={(analytics.data as any).shortages?.length != null ? fmtNum((analytics.data as any).shortages?.length) : '—'} />
            <MiniStat label="Departments" value={(analytics.data as any).by_department ? String(Object.keys((analytics.data as any).by_department).length) : '—'} />
            <MiniStat label="Categories" value={(analytics.data as any).by_category ? String(Object.keys((analytics.data as any).by_category).length) : '—'} />
          </div>
        </Card>
      ) : null}
    </div>
  )
}

function BarList({ data }: { data: Array<[string, number]> }) {
  const max = Math.max(1, ...data.map(([, v]) => v))
  const colors: Record<string, string> = {
    low: 'bg-emerald-400',
    moderate: 'bg-amber-400',
    high: 'bg-rose-400',
    critical: 'bg-rose-500',
  }
  return (
    <div className="space-y-2">
      {data.map(([k, v]) => (
        <div key={k} className="flex items-center gap-2 text-sm">
          <span className="w-20 capitalize text-slate-400">{k}</span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-ink-700/70">
            <div className={cx('h-full rounded-full', colors[k] || 'bg-ice-400')} style={{ width: `${(v / max) * 100}%` }} />
          </div>
          <span className="w-6 text-right tabular-nums text-slate-300">{v}</span>
        </div>
      ))}
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-ink-700/50 bg-ink-800/40 p-3">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-xl font-bold tabular-nums text-slate-100">{value}</div>
    </div>
  )
}