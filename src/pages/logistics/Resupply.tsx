import { useMemo } from 'react'
import { useMission } from '../../context/MissionContext'
import { Badge, Card, SectionTitle, Spinner, statusTone, useApi } from '../../components/ui'

export default function Resupply() {
  const { selected } = useMission()
  const mid = selected?.id
  const clock = useApi<any[]>(mid ? `/api/inventory/survival-clock/all?mission_id=${mid}` : null)
  const predictions = useApi<any[]>(mid ? `/api/inventory/predictions/all?mission_id=${mid}` : null)

  const list = useMemo(() => (predictions.data || []).filter((p) => p?.days_remaining != null), [predictions.data])
  const dtr = clock.data?.[0]?.days_to_resupply

  const topNeed = useMemo(() => [...list].sort((a, b) => (a.days_remaining ?? 1e9) - (b.days_remaining ?? 1e9)).slice(0, 6), [list])
  const urgent = list.filter((p) => p.days_remaining != null && dtr != null && p.days_remaining < dtr).length

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-slate-50">Resupply Planner</h1>
        <p className="text-xs text-slate-400">
          AI depletion predictions for <b className="text-ice-300">{selected?.mission_id || 'selected mission'}</b>
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <SectionTitle title="Survival clock" sub="days of supply until resupply horizon" />
          {clock.loading ? <Spinner /> : null}
          {!clock.loading && !clock.data?.length ? <p className="text-sm text-slate-400">No survival data. Select a mission with inventory.</p> : null}
          <div className="space-y-3">
            {(clock.data || []).map((c) => (
              <div key={c.category} className="rounded-xl border border-ink-700/50 bg-ink-800/40 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-200">{c.label}</span>
                  <Badge tone={statusTone(c.status)}>{c.days_remaining != null ? `${c.days_remaining} days` : '—'}</Badge>
                </div>
                <div className="mt-0.5 text-xs text-slate-500">
                  {c.item ? `leading item: ${c.item} · ` : ''}
                  {c.days_to_resupply != null ? `next resupply in ${c.days_to_resupply}d` : 'no future resupply window'}
                  {c.resupply_date ? ` (${c.resupply_date})` : ''}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <SectionTitle title="Depletion order" sub="categories that exhaust first — plan priority" />
          {predictions.loading ? <Spinner /> : null}
          {!predictions.loading && !topNeed.length ? <p className="text-sm text-slate-400">No depletion predictions yet.</p> : null}
          <div className="space-y-2">
            {topNeed.map((p) => (
              <div key={p.item_id ?? p.item ?? p.category} className="flex items-center justify-between rounded-lg bg-ink-800/50 px-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <div className="truncate font-medium text-slate-200">{p.item || p.category}</div>
                  <div className="truncate text-xs text-slate-500">
                    {(p.reasons && p.reasons[0]) || `status ${p.status}`}
                  </div>
                </div>
                <div className="ml-2 text-right">
                  <div className="font-bold tabular-nums text-ice-300">
                    {p.days_remaining != null ? `${p.days_remaining}d` : '—'}
                  </div>
                  {p.depletion_date ? <div className="text-[10px] text-slate-500">by {p.depletion_date}</div> : null}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {urgent ? (
        <p className="text-xs text-slate-500">
          {urgent} item{urgent === 1 ? '' : 's'} deplete{' '}
          {dtr != null ? `before the next resupply window (${dtr}d)` : 'ahead of resupply'} — prioritize these in the next shipment manifest.
        </p>
      ) : null}
    </div>
  )
}