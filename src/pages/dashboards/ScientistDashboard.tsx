import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { fmtNum } from '../../lib/api'
import { Badge, Card, Icon, Progress, SectionTitle, Spinner, Stat, statusTone, useApi } from '../../components/ui'
import type { Overview } from '../../lib/types'

export default function ScientistDashboard() {
  const { user } = useAuth()
  const mid = user?.mission_id
  const overview = useApi<Overview | null>(mid ? `/api/missions/${mid}/overview` : null)
  const tasks = useApi<any[]>(mid ? `/api/tasks?mission_id=${mid}` : null)
  const assets = useApi<any[]>('/api/assets?')
  const weather = useApi<any[]>(mid ? `/api/weather?station_id=${user?.station_id || ''}` : null)

  const ov = overview.data
  const myTasks = (tasks.data || []).filter((t) => !t.personnel_id || t.personnel_id === user?.id)
  const sciGear = (assets.data || []).filter((a) => a.category === 'scientific' || a.type === 'scientific')
  const openTasks = myTasks.filter((t) => !['done', 'cancelled'].includes(t.status)).length
  const latestW = (weather.data || [])[0]

  return (
    <div className="space-y-5">
      {/* My mission hero */}
      {ov ? (
        <Card className="border-ice-700/40 bg-gradient-to-br from-ink-900 via-ink-900 to-ice-900/30 p-5">
          <div className="flex flex-wrap items-center gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-widest text-ice-400">My mission</span>
                <Badge tone={statusTone(ov.mission.status)}>{ov.mission.status}</Badge>
              </div>
              <h1 className="mt-1 text-xl font-black text-slate-50">{ov.mission.mission_id} · {ov.mission.name}</h1>
              <p className="text-sm text-slate-400">{ov.mission.destination} — day {ov.mission.elapsed_days} of {ov.mission.total_days}</p>
              <div className="mt-3 flex items-center gap-3 text-sm">
                <span className="text-slate-300">Progress</span>
                <span className="w-56"><Progress value={ov.mission.progress || 0} /></span>
                <b className="text-ice-300">{ov.mission.progress || 0}%</b>
              </div>
            </div>
            <Link className="rounded-lg border border-ice-400/40 px-3 py-2 text-sm font-medium text-ice-200 hover:bg-ice-400/10" to={`/missions/${ov.mission.id}`}>
              Mission briefing →
            </Link>
          </div>
        </Card>
      ) : overview.loading ? (
        <Spinner label="Loading your mission…" />
      ) : (
        <Card className="p-6 text-center text-sm text-slate-400">You are not yet assigned to a mission.</Card>
      )}

      {/* Research stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="My open tasks" value={fmtNum(openTasks)} sub={`${myTasks.length} total assigned`} tone={openTasks ? 'ice' : 'good'} />
        <Stat label="Scientific assets" value={fmtNum(sciGear.length)} sub="inventory & instruments" tone="default" />
        <Stat label="Weather condition" value={latestW?.condition || '—'} sub={latestW ? `${fmtNum(latestW.temperature_c, 1)}°C· wind ${fmtNum(latestW.wind_speed)}km/h` : 'no data'} tone={latestW?.storm ? 'warn' : 'default'} />
        <Stat label="Survival (supplies)" value={ov ? `${ov.resources.food_days ?? '—'}d` : '—'} sub="food days remaining" tone={statusTone(ov?.resources?.food_status)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* My research tasks */}
        <Card className="p-4">
          <SectionTitle title="Research tasks" sub="assigned to me" right={<Link to="/scientist/tasks" className="text-xs text-ice-300">manage tasks</Link>} />
          {tasks.loading ? <Spinner /> : null}
          {!tasks.loading && !myTasks.length ? <p className="text-sm text-slate-400">No research tasks assigned yet.</p> : null}
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {myTasks.slice(0, 10).map((t) => (
              <div key={t.id} className="flex items-start gap-2 rounded-lg bg-ink-800/50 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-slate-100">{t.title}</span>
                    <Badge tone={statusTone(t.status)}>{t.status}</Badge>
                  </div>
                  {t.due_date ? <div className="mt-0.5 text-xs text-slate-500">due {t.due_date} · priority {t.priority}</div> : null}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Team / field view */}
        <Card className="p-4">
          <SectionTitle title="Station & expedition" sub="who is around my work location" />
          <div className="space-y-2">
            <LocationRow />
          </div>
        </Card>
      </div>
    </div>
  )
}

function LocationRow() {
  const { can } = useAuth()
  return (
    <>
      <div className="flex items-center gap-3 rounded-xl border border-ink-700/50 bg-ink-800/40 p-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-ice-500/15"><Icon name="map" size={18} className="text-ice-300" /></div>
        <div>
          <div className="text-sm font-medium text-slate-200">Field location</div>
          <div className="text-xs text-slate-400">View live positions on the operations map</div>
        </div>
      </div>
      {can('ai:use') ? (
        <div className="flex items-center gap-3 rounded-xl border border-ink-700/50 bg-ink-800/40 p-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/15"><Icon name="ai" size={18} className="text-violet-300" /></div>
          <div>
            <div className="text-sm font-medium text-slate-200">DHRUVA AI assistant</div>
            <div className="text-xs text-slate-400">Research queries, data summaries, field guidance</div>
          </div>
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <Link to="/map" className="rounded-lg bg-ice-500 px-3 py-2 text-sm font-medium text-ink-950 hover:bg-ice-400">Open map</Link>
        <Link to="/assistant" className="rounded-lg border border-ice-400/40 px-3 py-2 text-sm font-medium text-ice-200 hover:bg-ice-400/10">Ask AI</Link>
        <Link to="/emergency" className="rounded-lg border border-rose-400/50 px-3 py-2 text-sm font-medium text-rose-300 hover:bg-rose-400/10">Emergency</Link>
      </div>
    </>
  )
}