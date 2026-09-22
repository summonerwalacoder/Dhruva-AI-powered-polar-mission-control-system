import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api, fmtNum } from '../lib/api'
import { Badge, Btn, Card, ErrorBox, Field, Icon, Modal, Progress, SectionTitle, Spinner, cx, inputCls, riskTone, statusTone, useApi } from '../components/ui'
import type { Overview, MissionSummary } from '../lib/types'

interface PlanSuggestion {
  category: string
  quantity: number
  unit: string
  reason: string
}

export default function MissionDetail() {
  const { id } = useParams()
  const mid = Number(id)
  const { can } = useAuth()
  const mission = useApi<MissionSummary>(`/api/missions/${mid}`)
  const ov = useApi<Overview>(`/api/missions/${mid}/overview`)
  const [planOpen, setPlanOpen] = useState(false)
  const [plan, setPlan] = useState<{ suggestions: PlanSuggestion[]; explanation: string; team_size: number; duration_days: number } | null>(null)
  const [planBusy, setPlanBusy] = useState(false)
  const [dur, setDur] = useState(60)
  const [team, setTeam] = useState(12)

  const aiAvailable = can('mission:write')

  const runPlan = async (e: React.FormEvent) => {
    e.preventDefault()
    setPlanBusy(true)
    try {
      const r = await api<any>(`/api/missions/${mid}/plan`, {
        method: 'POST',
        body: JSON.stringify({ duration_days: dur, team_size: team }),
      })
      setPlan({ suggestions: r.suggestions, explanation: r.explanation, team_size: r.team_size, duration_days: r.duration_days })
    } finally {
      setPlanBusy(false)
    }
  }

  if (ov.loading) return <Spinner label="Loading mission…" />
  if (ov.error) return <ErrorBox message={ov.error} onRetry={ov.reload} />
  if (!ov.data) return null

  const d = ov.data

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-50">{d.mission.mission_id}</h1>
              <Badge tone={statusTone(d.mission.status)}>{d.mission.status}</Badge>
              <Badge tone={riskTone(d.risk.level)}>risk {d.risk.level}</Badge>
            </div>
            <p className="mt-0.5 text-sm text-slate-400">
              {d.mission.name}
              {d.mission.station ? ` · ${d.mission.station.code} (${d.mission.station.name})` : ''}
              {mission.data?.region ? ` · ${mission.data.region}` : ''}
            </p>
          </div>
          {aiAvailable ? (
            <Btn onClick={() => setPlanOpen(true)}>
              <Icon name="ai" size={16} /> AI planning assistant
            </Btn>
          ) : null}
        </div>

        <div className="mt-3">
          <div className="mb-1 flex justify-between text-xs text-slate-400">
            <span>Day {d.mission.elapsed_days} of {d.mission.total_days}</span>
            <span>{d.mission.remaining_days} days remaining</span>
          </div>
          <Progress value={d.mission.progress} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Mini label="Team" value={`${d.mission.team_size_actual} / ${d.mission.team_size_planned}`} />
          <Mini label="Cargo" value={fmtNum(d.counts.cargo_items)} sub={`${d.counts.containers} containers`} />
          <Mini label="Delayed cargo" value={fmtNum(d.counts.delayed_cargo)} warn={d.counts.delayed_cargo > 0} />
          <Mini label="Critical assets" value={fmtNum(d.counts.critical_assets)} warn={d.counts.critical_assets > 0} />
        </div>
      </Card>

      {d.mission.objective ? (
        <Card className="p-4">
          <SectionTitle title="Objective" />
          <p className="text-sm leading-relaxed text-slate-300">{d.mission.objective}</p>
        </Card>
      ) : null}

      {/* Risk */}
      <Card className="p-4">
        <SectionTitle title="Risk assessment" right={<Badge tone={riskTone(d.risk.level)}>{d.risk.level}</Badge>} />
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="space-y-1 text-sm text-slate-300">
            {(d.risk.reasons || []).map((r, i) => (
              <div key={i} className="flex gap-1.5"><span className="text-ice-400">•</span>{r}</div>
            ))}
          </div>
          <div className="rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-200">
            <div className="mb-1 text-[11px] uppercase tracking-wide text-emerald-400/70">Recommended actions</div>
            {(d.risk.actions || []).map((a, i) => (
              <div key={i} className="flex gap-1.5 py-0.5"><span className="text-emerald-400">→</span>{a}</div>
            ))}
          </div>
        </div>
      </Card>

      {/* Resources */}
      <Card className="p-4">
        <SectionTitle title="Supply status" sub="Days remaining for critical categories" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {d.survival_clock.map((c) => (
            <div key={c.category} className={cx('rounded-xl border p-3', c.status === 'shortage' || c.status === 'critical' ? 'border-rose-400/40' : 'border-ink-700/50')}>
              <div className="text-[11px] uppercase tracking-wide text-slate-400">{c.label}</div>
              <div className="my-0.5 text-xl font-bold tabular-nums text-slate-100">{c.days_remaining == null ? '—' : `${c.days_remaining} days`}</div>
              <div className="truncate text-[11px] text-slate-500">{c.item}</div>
              <div className="mt-1"><Badge tone={statusTone(c.status)}>{c.status}</Badge></div>
            </div>
          ))}
        </div>
        {d.resupply_plan || d.next_resupply ? (
          <div className="mt-3 text-sm text-slate-300">
            Next resupply: <b className="text-ice-300">{d.next_resupply || d.resupply_plan}</b>
          </div>
        ) : null}
      </Card>

      {planOpen ? (
        <Modal open onClose={() => setPlanOpen(false)} title="AI mission planning assistant" wide>
          {!plan ? (
            <form onSubmit={runPlan} className="space-y-3">
              <p className="text-sm text-slate-400">
                Generate an initial resource plan (heuristic) for this mission — edit before saving.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Duration (days)">
                  <input type="number" min={1} className={inputCls} value={dur} onChange={(e) => setDur(Number(e.target.value))} />
                </Field>
                <Field label="Team size">
                  <input type="number" min={1} className={inputCls} value={team} onChange={(e) => setTeam(Number(e.target.value))} />
                </Field>
              </div>
              <Btn type="submit" disabled={planBusy}>{planBusy ? 'Planning…' : 'Generate plan'}</Btn>
            </form>
          ) : (
            <div className="space-y-3">
              <div className="rounded-lg bg-ink-800/70 p-3 text-sm text-slate-300">
                <b>Plan basis:</b> {plan.team_size} people × {plan.duration_days} days
              </div>
              <div className="space-y-2">
                {plan.suggestions.map((s) => (
                  <div key={s.category} className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-ink-700/50 p-3">
                    <div>
                      <div className="text-sm font-medium capitalize text-slate-100">{s.category}</div>
                      <div className="mt-0.5 text-xs text-slate-400">{s.reason}</div>
                    </div>
                    <div className="text-lg font-bold tabular-nums text-ice-300">
                      {fmtNum(s.quantity, 1)} <span className="text-xs font-normal text-slate-400">{s.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-slate-500">{plan.explanation}</p>
              <div className="flex gap-2">
                <Btn onClick={() => setPlan(null)} kind="ghost">Adjust inputs</Btn>
                <Btn onClick={() => setPlanOpen(false)}>Done</Btn>
              </div>
            </div>
          )}
        </Modal>
      ) : null}
    </div>
  )
}

function Mini({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div className="rounded-lg bg-ink-800/60 p-3">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={cx('text-lg font-bold tabular-nums', warn ? 'text-amber-300' : 'text-ice-200')}>{value}</div>
      {sub ? <div className="text-[11px] text-slate-500">{sub}</div> : null}
    </div>
  )
}