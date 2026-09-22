import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useMission } from '../../context/MissionContext'
import { api, fmtNum } from '../../lib/api'
import { Badge, Card, ErrorBox, Icon, Progress, SectionTitle, Spinner, Stat, cx, riskTone, statusTone, useApi } from '../../components/ui'
import type { MissionSummary, Overview } from '../../lib/types'

export default function CommanderDashboard() {
  const { can } = useAuth()
  const { selectedId } = useMission()
  const { data, loading } = useApi<MissionSummary[]>('/api/missions')

  const m = data?.find((x) => x.id === selectedId) || data?.[0]

  return (
    <div className="space-y-5">
      {loading ? <Spinner label="Loading mission control…" /> : null}
      {!loading && !m ? (
        <Card className="p-8 text-center">
          <p className="text-2xl">🎯</p>
          <p className="mt-2 text-sm text-slate-400">No mission available for command. Create or assign a mission first.</p>
          {can('mission:write') ? <Link to="/missions"><span className="mt-3 inline-block text-sm text-ice-300 hover:underline">Open Missions →</span></Link> : null}
        </Card>
      ) : null}
      {m ? <MissionControlPanel key={m.id} mission={m} /> : null}
    </div>
  )
}

function MissionControlPanel({ mission }: { mission: MissionSummary }) {
  const { data, loading, error, reload } = useApi<Overview>(`/api/missions/${mission.id}/overview`)
  const alerts = useApi<any[]>(`/api/alerts?mission_id=${mission.id}&status=active`)
  const { can } = useAuth()

  if (loading) return <Spinner label="Loading mission overview…" />
  if (error) return <ErrorBox message={error} onRetry={reload} />
  if (!data) return null

  const ov = data
  const risk = ov.risk
  const tone = riskTone(risk.level)

  return (
    <div className="space-y-5">
      {/* Hero: mission status + risk gauge */}
      <Card className={cx('hero-glow border p-5', risk.level === 'high' || risk.level === 'critical' ? 'border-rose-400/50' : 'border-ink-700/60')}>
        <div className="flex flex-col gap-5 md:flex-row md:items-center">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-black tracking-wide text-slate-50">{ov.mission.mission_id}</h1>
              <Badge tone={statusTone(ov.mission.status)}>{ov.mission.status}</Badge>
              <Badge tone={tone}>RISK {risk.level}</Badge>
            </div>
            <p className="truncate text-sm text-slate-400">{ov.mission.name} → {ov.mission.destination}</p>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-slate-300">
              <span>Day <b className="text-ice-200">{ov.mission.elapsed_days}</b> of {ov.mission.total_days}</span>
              <span className="w-44"><Progress value={ov.mission.progress || 0} /></span>
              <span className="text-ice-300">{ov.mission.progress || 0}%</span>
            </div>
            {(risk.reasons || []).slice(0, 3).map((r, i) => (
              <div key={i} className="mt-1 flex gap-1.5 text-sm text-slate-400"><span className="text-ice-400">•</span>{r}</div>
            ))}
          </div>

          <div className="flex items-center gap-4 rounded-2xl border border-ink-700/50 bg-ink-800/50 p-4">
            <RiskGauge level={risk.level} score={risk.score} />
            <div className="space-y-1.5 text-sm">
              <div className="text-[10px] uppercase tracking-widest text-slate-500">Mission risk score</div>
              <div className="text-3xl font-black tabular-nums text-slate-100">{fmtNum(risk.score, 2)}</div>
              <div className="text-xs text-slate-400">AI-evaluated</div>
              {(risk.actions || []).length ? (
                <div className="max-w-56 rounded-lg bg-emerald-500/10 px-2 py-1 text-xs text-emerald-200">
                  <b>Recommended:</b> {(risk.actions || []).slice(0, 2).join(' • ')}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </Card>

      {/* Big operational KPI tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Personnel deployed" value={fmtNum(ov.counts.personnel)} sub={`planned ${ov.mission.team_size_planned}`} tone="ice" />
        <Stat label="Fuel remaining" value={ov.resources.fuel_days != null ? `${ov.resources.fuel_days}d` : '—'} sub={ov.resources.fuel_status || 'not tracked'} tone={statusTone(ov.resources.fuel_status)} />
        <Stat label="Food remaining" value={ov.resources.food_days != null ? `${ov.resources.food_days}d` : '—'} sub={ov.resources.food_status || ''} tone={statusTone(ov.resources.food_status)} />
        <Stat label="Medical supplies" value={ov.resources.medical_days != null ? `${ov.resources.medical_days}d` : '—'} sub={ov.resources.medical_status || 'not tracked'} tone={statusTone(ov.resources.medical_status)} />
        <Stat label="Critical assets" value={fmtNum(ov.counts.critical_assets)} sub="need maintenance" tone={ov.counts.critical_assets ? 'bad' : 'good'} />
        <Stat label="Cargo delays" value={fmtNum(ov.counts.delayed_cargo)} sub={ov.counts.delayed_cargo ? 'attention required' : 'on schedule'} tone={ov.counts.delayed_cargo ? 'warn' : 'default'} />
        <Stat label="Active emergencies" value={fmtNum(ov.counts.open_emergencies)} sub="live incidents" tone={ov.counts.open_emergencies ? 'warn' : 'good'} />
        <Stat label="Next resupply" value={ov.next_resupply ? String(ov.next_resupply).split('T')[0] : 'By mission end'} sub="planned window" tone="default" />
      </div>

      {/* Survival clock — large */}
      <Card className="p-4">
        <SectionTitle title="Survival clock" sub="Days of supply by critical resource" />
        {ov.survival_clock?.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {ov.survival_clock.map((c) => (
              <div key={c.category} className="rounded-xl border border-ink-700/50 bg-ink-800/50 p-3">
                <div className="text-[11px] uppercase tracking-wide text-slate-400">{c.label}</div>
                <div className={cx('my-1 text-3xl font-black tabular-nums', statusTone(c.status) === 'green' ? 'text-emerald-300' : statusTone(c.status) === 'amber' ? 'text-amber-300' : statusTone(c.status) === 'red' ? 'text-rose-300' : 'text-slate-100')}>
                  {c.days_remaining == null ? '—' : `${c.days_remaining}d`}
                </div>
                <div className="truncate text-[11px] text-slate-500">{c.item || 'not tracked'}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">No survival data yet.</p>
        )}
      </Card>

      {/* Live weather + AI recommendation + alerts ticker */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-4">
          <SectionTitle title="Live weather" sub={ov.weather?.label || ''} />
          {!ov.weather || ov.weather.source === 'none' ? (
            <p className="text-sm text-slate-400">No live weather recorded for this station.</p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-end gap-2">
                <div className="text-5xl font-black tabular-nums text-slate-50">{fmtNum(ov.weather.temperature_c, 1)}°</div>
                <Badge tone="ice">{ov.weather.condition || '—'}</Badge>
                {ov.weather.storm ? <Badge tone="red">STORM</Badge> : null}
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-lg bg-ink-800/60 p-2.5"><div className="text-[10px] text-slate-500">Wind</div><b className="text-slate-100">{fmtNum(ov.weather.wind_speed)} km/h</b></div>
                <div className="rounded-lg bg-ink-800/60 p-2.5"><div className="text-[10px] text-slate-500">Visibility</div><b className="text-slate-100">{ov.weather.visibility_km != null ? `${fmtNum(ov.weather.visibility_km, 1)} km` : '—'}</b></div>
              </div>
              {ov.weather.ice_route_condition ? (
                <div className="rounded-lg bg-ink-800/50 px-2.5 py-1.5 text-xs text-slate-400">
                  ice route: <b className="text-ice-200">{ov.weather.ice_route_condition}</b>
                </div>
              ) : null}
            </div>
          )}
        </Card>

        <Card className="p-4">
          <SectionTitle title="AI recommendation" sub="from mission state" />
          <AiRecommendation missionId={mission.id} />
          <div className="mt-3 flex flex-wrap gap-2">
            {can('simulate:use') ? <Link to="/simulations" className="rounded-lg bg-ice-500 px-3 py-2 text-sm font-medium text-ink-950 hover:bg-ice-400">Run what-if simulation</Link> : null}
            {can('ai:use') ? <Link to="/assistant" className="rounded-lg border border-ice-400/40 px-3 py-2 text-sm font-medium text-ice-300 hover:bg-ice-400/10">Ask DHRUVA AI</Link> : null}
          </div>
        </Card>

        <Card className="p-4">
          <SectionTitle title="Active alerts" sub={`${alerts.data?.length || 0} open`} right={<Link className="text-xs text-ice-300" to="/alerts">view all</Link>} />
          {!alerts.loading && !alerts.data?.length ? <p className="text-sm text-slate-400">No active alerts. All clear.</p> : null}
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {(alerts.data || []).slice(0, 8).map((a) => (
              <div key={a.id} className="flex items-start gap-2 rounded-lg bg-ink-800/50 px-2.5 py-2 text-sm">
                <Badge tone={statusTone(a.severity)}>{a.severity}</Badge>
                <span className="text-slate-300">{a.title}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Quick command actions */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <QuickAction to="/map" icon="map" label="Operations map" />
        <QuickAction to="/personnel" icon="personnel" label="Personnel status" />
        <QuickAction to="/emergency" icon="emergency" label="Emergency ops" />
        <QuickAction to={`/missions/${ov.mission.id}`} icon="mission" label="Mission detail" />
      </div>
    </div>
  )
}

/** Fetches a short planning recommendation from the AI assistant. */
function AiRecommendation({ missionId }: { missionId: number }) {
  const [text, setText] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    setText(null)
    api<{ reply: string }>('/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({
        mission_id: missionId,
        message: 'Give me a concise command recommendation for the current mission state — top priority actions for the commander.',
      }),
    })
      .then((r) => {
        if (alive) setText(r?.reply || '')
      })
      .catch(() => {
        if (alive) setText('')
      })
    return () => {
      alive = false
    }
  }, [missionId])

  if (text === null)
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-slate-400">
        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-ice-400 border-t-transparent" />
        Evaluating mission state…
      </div>
    )
  if (!text) return <p className="rounded-lg bg-ink-800/50 p-3 text-sm leading-relaxed text-slate-300">Rule-engine active — check back shortly.</p>
  return <p className="rounded-lg bg-ink-800/50 p-3 text-sm leading-relaxed text-slate-300">{text}</p>
}

function RiskGauge({ level, score }: { level: string; score: number | null | undefined }) {
  const pct = Math.min(100, Math.max(0, (score || 0) * 100))
  const color = level === 'severe' || level === 'critical' ? 'text-rose-300' : level === 'high' ? 'text-amber-300' : level === 'medium' ? 'text-ice-300' : 'text-emerald-300'
  return (
    <div className="relative h-24 w-24 shrink-0">
      <svg viewBox="0 0 100 100" className="h-24 w-24 -rotate-90">
        <circle cx="50" cy="50" r="42" fill="none" stroke="#12233b" strokeWidth="10" />
        <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="10" strokeDasharray={`${(pct / 100) * 264} 264`} strokeLinecap="round" className={color} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className={cx('text-2xl font-black tabular-nums', color)}>{fmtNum(pct)}</div>
        <div className="text-[8px] uppercase tracking-widest text-slate-500">risk</div>
      </div>
    </div>
  )
}

function QuickAction({ to, icon, label }: { to: string; icon: string; label: string }) {
  return (
    <Link to={to} className="flex items-center gap-2 rounded-xl border border-ink-700/60 bg-ink-800/50 px-3 py-3 text-sm text-slate-200 transition-colors hover:border-ice-500 hover:text-ice-200">
      <Icon name={icon} size={17} />
      <span className="truncate">{label}</span>
    </Link>
  )
}