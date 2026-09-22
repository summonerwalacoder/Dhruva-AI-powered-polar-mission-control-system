import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useMission } from '../context/MissionContext'
import { api, apiQueued, ApiError } from '../lib/api'
import { offlineTriage } from '../lib/offlineEngine'
import { Badge, Btn, Card, Empty, ErrorBox, Icon, SectionTitle, Spinner, cx, inputCls, statusTone, useApi } from '../components/ui'
import type { Emergency, EmergencyInterpret } from '../lib/types'

export default function Emergency() {
  const { can } = useAuth()
  const { selectedId } = useMission()
  const [tab, setTab] = useState<'open' | 'all'>('open')
  const [aiText, setAiText] = useState('')
  const [aiResult, setAiResult] = useState<EmergencyInterpret | null>(null)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiErr, setAiErr] = useState('')

  const canReadList = can('emergency:read')
  const path = canReadList ? `/api/emergencies?mission_id=${selectedId || ''}${tab === 'open' ? '&status=open' : ''}` : null
  const { data, loading, error, reload } = useApi<Emergency[]>(path)

  const interpret = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!aiText.trim()) return
    setAiBusy(true)
    setAiErr('')
    setAiResult(null)
    try {
      const r = await api<EmergencyInterpret>('/api/emergencies/ai-interpret', {
        method: 'POST',
        body: JSON.stringify({ mission_id: selectedId, description: aiText, voice: false }),
      })
      setAiResult(r)
    } catch (e: any) {
      if (e instanceof ApiError && e.status === 0) {
        setAiResult(await offlineTriage(aiText.trim()))
      } else {
        setAiErr(e?.detail || e?.message || 'Interpretation failed')
      }
    } finally {
      setAiBusy(false)
    }
  }

  const createSuggested = async () => {
    if (!aiResult) return
    const s = aiResult.suggested_emergency_create
    await apiQueued('/api/emergencies', {
      method: 'POST',
      body: JSON.stringify({ ...s, mission_id: selectedId, connectivity_status: navigator.onLine ? 'online' : 'offline', offline_queued: !navigator.onLine }),
      entity: 'emergency',
      entity_id: `emr-${Date.now()}`,
      operation: 'upsert',
    })
    setAiResult(null)
    setAiText('')
    reload()
  }

  const resolve = async (id: string) => {
    if (!can('emergency:respond')) return
    await api(`/api/emergencies/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'resolved' }) })
    reload()
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-slate-50">Emergency Operations</h1>
        <p className="text-xs text-slate-400">AI-assisted triage · SOS · offline-queued reporting</p>
      </div>

      <Card className="p-4">
        <SectionTitle title="AI emergency interpretation" sub="Describe the incident in English or Hindi — DHRUVA classifies and suggests response" />
        <form onSubmit={interpret} className="flex gap-2">
          <input
            className={inputCls + ' flex-1'}
            placeholder='e.g. "Generator band ho gaya aur weather kharab hai…"'
            value={aiText}
            onChange={(e) => setAiText(e.target.value)}
          />
          <Btn type="submit" disabled={aiBusy || !aiText.trim()}>
            <Icon name="ai" size={16} /> {aiBusy ? '…' : 'Interpret'}
          </Btn>
        </form>
        {aiErr ? <div className="mt-2 text-xs text-rose-300">{aiErr}</div> : null}
        {aiResult ? (
          <Card className="mt-3 fade-up border-ice-500/30 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-slate-100">{aiResult.type_label}</span>
              <Badge tone={statusTone(aiResult.severity)}>{aiResult.severity}</Badge>
              <Badge tone="ice">{aiResult.language} · {aiResult.provider}</Badge>
            </div>
            <div className="mt-2 space-y-1 text-sm text-slate-300">
              {(aiResult.recommended_next_steps || []).map((s, i) => (
                <div key={i} className="flex gap-1.5"><span className="text-ice-400">→</span>{s}</div>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <Btn onClick={createSuggested}>Create emergency  →</Btn>
              <Btn kind="ghost" onClick={() => setAiResult(null)}>Dismiss</Btn>
            </div>
          </Card>
        ) : null}
      </Card>

      <div className="flex gap-2">
        <button onClick={() => setTab('open')} className={cx('rounded-full px-3 py-1.5 text-xs', tab === 'open' ? 'bg-ice-500 text-ink-950' : 'bg-ink-800 text-slate-300')}>
          Open / active
        </button>
        <button onClick={() => setTab('all')} className={cx('rounded-full px-3 py-1.5 text-xs', tab === 'all' ? 'bg-ice-500 text-ink-950' : 'bg-ink-800 text-slate-300')}>
          All
        </button>
      </div>

      {!canReadList ? (
        <Card className="p-4 text-sm text-slate-400">
          The incident feed is command-level (HQ, commander, medical). Your access is <b className="text-ice-300">report-only</b> — keep using the AI triage and SOS above; reports are queued when offline and raised at command.
        </Card>
      ) : (
        <>
          {loading ? <Spinner /> : null}
          {error ? <ErrorBox message={error} onRetry={reload} /> : null}
          {!loading && !error && data?.length === 0 ? <Empty label="No emergencies." /> : null}

          <div className="grid gap-3 md:grid-cols-2">
            {(data || []).map((e) => (
              <Card key={e.id} className={cx('p-4', e.severity === 'critical' && e.status !== 'resolved' ? 'border-rose-400/60' : e.status !== 'resolved' && e.severity === 'serious' ? 'border-amber-400/50' : 'border-ink-700/60')}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-slate-50">{e.emergency_id}</span>
                      <Badge tone={statusTone(e.severity)}>{e.severity}</Badge>
                      <Badge tone={e.status === 'resolved' ? 'green' : 'amber'}>{e.status}</Badge>
                    </div>
                    <div className="mt-0.5 text-[11px] uppercase tracking-wide text-slate-500">{e.type}</div>
                  </div>
                  {e.status !== 'resolved' && can('emergency:respond') ? (
                    <Btn kind="outline" onClick={() => resolve(e.emergency_id)}>Resolve</Btn>
                  ) : null}
                </div>
                {e.description ? <p className="mt-2 text-sm text-slate-300">{e.description}</p> : null}
                {e.recommended_response ? (
                  <div className="mt-2 rounded-lg bg-emerald-500/10 px-2.5 py-1.5 text-xs text-emerald-200">
                    <b>Response:</b> {e.recommended_response}
                  </div>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-500">
                  {e.location ? <span>📌 {e.location}</span> : null}
                  {e.offline_queued ? <Badge tone="amber">queued offline</Badge> : null}
                  {e.connectivity_status ? <span>· {e.connectivity_status}</span> : null}
                  <span>· {e.reported_at?.slice(0, 16)}</span>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}