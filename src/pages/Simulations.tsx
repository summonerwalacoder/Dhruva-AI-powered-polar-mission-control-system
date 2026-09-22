import { useState } from 'react'
import { useMission } from '../context/MissionContext'
import { api, ApiError } from '../lib/api'
import { offlineSimulate } from '../lib/offlineEngine'
import { Badge, Btn, Card, Empty, Field, Icon, SectionTitle, Spinner, cx, inputCls, riskTone, statusTone, useApi } from '../components/ui'
import type { SimulationResult } from '../lib/types'

const HINTS = [
  'resupply delayed by 10 days',
  'fuel consumption increases by 20%',
  'team size increases by 5',
  'generator fails',
  'vehicle becomes unavailable',
  'severe weather blocks route',
  'cargo lost',
  'communication outage',
]

export default function Simulations() {
  const { selectedId } = useMission()
  const [text, setText] = useState('resupply delayed by 10 days')
  const [delay, setDelay] = useState(0)
  const [fuelPct, setFuelPct] = useState(100)
  const [teamInc, setTeamInc] = useState(0)
  const [toggles, setToggles] = useState<Record<string, boolean>>({})
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<SimulationResult | null>(null)
  const [offlineNote, setOfflineNote] = useState(false)
  const [error, setError] = useState('')
  const { data, loading, reload } = useApi<SimulationResult[]>(`/api/simulations?mission_id=${selectedId || ''}`)

  const toggle = (k: string) => setToggles((t) => ({ ...t, [k]: !t[k] }))

  const run = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedId) return
    setRunning(true)
    setError('')
    const scenario = {
      resupply_delay_days: delay,
      fuel_consumption_pct: fuelPct,
      team_increase: teamInc,
      generator_fail: !!toggles.generator_fail,
      vehicle_unavailable: !!toggles.vehicle_unavailable,
      severe_weather_blocks_route: !!toggles.severe_weather_blocks_route,
      cargo_lost: !!toggles.cargo_lost,
      communication_outage: !!toggles.communication_outage,
    }
    try {
      const r = await api<SimulationResult>('/api/simulations', {
        method: 'POST',
        body: JSON.stringify({
          mission_id: selectedId,
          name: text || 'Scenario simulation',
          scenario,
        }),
      })
      setResult(r)
      setOfflineNote(false)
      reload()
    } catch (e: any) {
      if (e instanceof ApiError && e.status === 0) {
        setResult(await offlineSimulate(selectedId, scenario))
        setOfflineNote(true)
      } else {
        setError(e?.detail || e?.message || 'Simulation failed')
      }
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-slate-50">What-if Simulations</h1>
        <p className="text-xs text-slate-400">Stress-test the mission plan under disruption scenarios</p>
      </div>

      {!selectedId ? (
        <Card className="p-6 text-center text-sm text-slate-400">Select a mission to simulate.</Card>
      ) : (
        <>
          <Card className="p-4">
            <form onSubmit={run} className="space-y-4">
              <Field label="Scenario (natural language)" hint="Try typing in Hindi too — e.g. अगर री-सप्लाई में 10 दिन देर हो जाए तो क्या होगा?">
                <input className={inputCls} value={text} onChange={(e) => setText(e.target.value)} />
              </Field>

              <div className="grid gap-3 sm:grid-cols-3">
                <Slider label="Resupply delay" value={`${delay} days`} min={0} max={30} val={delay} set={(v) => setDelay(v)} />
                <Slider label="Fuel consumption" value={`${fuelPct}%`} min={80} max={150} val={fuelPct} set={(v) => setFuelPct(v)} />
                <Slider label="Team increase" value={`+${teamInc}`} min={0} max={15} val={teamInc} set={(v) => setTeamInc(v)} />
              </div>

              <div className="flex flex-wrap gap-2">
                {(['generator_fail', 'vehicle_unavailable', 'severe_weather_blocks_route', 'cargo_lost', 'communication_outage'] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => toggle(k)}
                    className={cx(
                      'rounded-full px-3 py-1.5 text-xs',
                      toggles[k] ? 'bg-rose-500/90 text-white' : 'bg-ink-800 text-slate-300 hover:bg-ink-700',
                    )}
                  >
                    {toggles[k] ? '✓ ' : ''}{k.replaceAll('_', ' ')}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {HINTS.map((h) => (
                  <button key={h} type="button" onClick={() => setText(h)} className="rounded-full border border-ink-700 px-2 py-0.5 text-[11px] text-slate-400 hover:border-ice-500 hover:text-ice-200">
                    {h}
                  </button>
                ))}
              </div>

              {error ? <div className="rounded-lg bg-rose-500/15 p-2.5 text-sm text-rose-300">{error}</div> : null}
              <Btn type="submit" disabled={running} className="w-full sm:w-auto">
                <Icon name="simulate" size={16} /> {running ? 'Running…' : 'Run simulation'}
              </Btn>
            </form>
          </Card>

          {running ? <Spinner label="Simulating…" /> : null}

          {result ? <ResultView r={result} offline={offlineNote} /> : null}

          <Card className="p-4">
            <SectionTitle title="Simulation history" />
            {loading ? <Spinner /> : null}
            {!loading && !data?.length ? <Empty label="No simulations yet." /> : null}
            <div className="space-y-2">
              {(data || []).slice(0, 6).map((s) => (
                <button
                  key={s.id}
                  onClick={() => setResult(s)}
                  className="flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border border-ink-700/50 bg-ink-800/40 p-3 text-left hover:border-ice-500/50"
                >
                  <div className="text-sm text-slate-200">
                    #{s.id} · {String(s.scenario?.resupply_delay_days || 0)}d delay · {s.scenario?.fuel_consumption_pct || 100}% fuel
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={riskTone(s.risk_before)}>{s.risk_before}</Badge>
                    <Icon name="chevron" size={12} />
                    <Badge tone={riskTone(s.risk_after)}>{s.risk_after}</Badge>
                  </div>
                </button>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  )
}

function Slider({ label, value, min, max, val, set }: { label: string; value: string; min: number; max: number; val: number; set: (v: number) => void }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium text-slate-300">{label}</span>
        <span className="font-bold tabular-nums text-ice-300">{value}</span>
      </div>
      <input type="range" min={min} max={max} value={val} onChange={(e) => set(Number(e.target.value))} className="w-full" />
    </div>
  )
}

function ResultView({ r, offline }: { r: SimulationResult; offline?: boolean }) {
  const b = r.before || r.baseline
  const a = r.after || r.result
  const bClock: any[] = b?.clock || []
  const aClock: any[] = a?.clock || []
  const impact = r.impact?.mission_impact || []

  return (
    <Card className="fade-up border-ice-500/30 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-ice-200">Simulation result</span>
        <div className="flex items-center gap-2 text-sm">
          {offline ? <Badge tone="amber">offline · local risk engine</Badge> : null}
          <Badge tone={riskTone(String(r.risk_before))}>{r.risk_before}</Badge>
          <span className="text-slate-500">→</span>
          <Badge tone={riskTone(String(r.risk_after))}>{r.risk_after}</Badge>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <div className="mb-1 text-[11px] uppercase tracking-wide text-slate-500">Before</div>
          {bClock.map((c) => <ClockRow key={c.category} c={c} />)}
        </div>
        <div>
          <div className="mb-1 text-[11px] uppercase tracking-wide text-slate-500">After scenario</div>
          {aClock.map((c) => <ClockRow key={c.category} c={c} />)}
        </div>
      </div>

      {impact.length ? (
        <div className="mt-3 space-y-1">
          <div className="text-[11px] uppercase tracking-wide text-slate-500">Impact</div>
          {impact.map((x: any, i: number) => (
            <div key={i} className="flex items-center justify-between rounded bg-ink-800/60 px-2.5 py-1.5 text-sm">
              <span className="text-slate-300">{x.resource}</span>
              <span className={cx('tabular-nums', x.impacted ? 'text-rose-300' : 'text-emerald-300')}>
                {x.was ?? '—'}d → {x.now ?? '—'}d
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {(r.result?.actions || []).length ? (
        <div className="mt-3 rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-200">
          <div className="mb-1 text-[11px] uppercase tracking-wide text-emerald-400/80">Recommended actions</div>
          {(r.result?.actions || []).map((x: any, i: number) => <div key={i} className="flex gap-1.5 py-0.5"><span className="text-emerald-400">→</span>{x}</div>)}
        </div>
      ) : null}
    </Card>
  )
}

function ClockRow({ c }: { c: any }) {
  return (
    <div className="flex items-center justify-between rounded bg-ink-800/50 px-2.5 py-1.5 text-sm">
      <span className="text-slate-300">{c.label || c.category}</span>
      <Badge tone={statusTone(c.status)}>{c.days_remaining == null ? '—' : `${c.days_remaining}d`}</Badge>
    </div>
  )
}