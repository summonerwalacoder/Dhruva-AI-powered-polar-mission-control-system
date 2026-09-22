import { Btn, Card, SectionTitle, Spinner, inputCls, useApi } from '../../components/ui'
import { api } from '../../lib/api'
import { useState } from 'react'

export default function AdminIntegrations() {
  const { data, loading, reload } = useApi<any[]>('/api/config')
  const aiStatus = useApi<any>('/api/ai/status')
  const weatherStatus = useApi<any>('/api/weather/status')
  const [vals, setVals] = useState<Record<string, string>>({})
  const [msg, setMsg] = useState('')

  const save = async (key: string) => {
    setMsg('')
    try {
      await api(`/api/config/${key}`, { method: 'PUT', body: JSON.stringify({ value: vals[key] ?? '' }) })
      setMsg(`Saved ${key}. Server will pick it up on next request.`)
      reload()
    } catch (e: any) {
      setMsg(e?.detail || e?.message || 'Failed')
    }
  }

  const rows = (data || []).filter((c) => /api|key|token|owed|threshold|policy|sms|smtp|slack|email/i.test(c.key))

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-slate-50">Integrations</h1>
        <p className="text-xs text-slate-400">External service credentials and system-wide policy keys</p>
      </div>

      {loading ? <Spinner /> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <SectionTitle title="External services" sub="live connectivity status" />
          <div className="space-y-2">
            <StatusRow name="AI / LLM" status={aiStatus.data} />
            <StatusRow name="Weather (OpenWeatherMap)" status={weatherStatus.data} />
          </div>
        </Card>

        <Card className="p-4">
          <SectionTitle title="Configured keys" sub="edit and save — credential values are masked" />
          {msg ? <p className="mb-2 text-sm text-ice-300">{msg}</p> : null}
          <div className="space-y-2">
            {(rows.length ? rows : data || []).slice(0, 16).map((c) => (
              <div key={c.key} className="rounded-lg border border-ink-700/50 bg-ink-800/40 p-2.5">
                <div className="mb-1 flex items-center justify-between">
                  <code className="text-xs text-ice-300">{c.key}</code>
                  <span className="text-[10px] text-slate-500">{configSet(c.value) ? 'set' : 'unset'}</span>
                </div>
                <div className="flex gap-2">
                  <input
                    className={inputCls + ' font-mono text-xs'}
                    placeholder={configSet(c.value) ? '•••••••• (keep current value)' : 'value'}
                    value={vals[c.key] ?? ''}
                    onChange={(e) => setVals((v) => ({ ...v, [c.key]: e.target.value }))}
                  />
                  <Btn kind="outline" className="shrink-0" onClick={() => save(c.key)}>Save</Btn>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

function StatusRow({ name, status }: { name: string; status: any }) {
  const ok = status?.llm_configured === true || status?.live_configured === true
  return (
    <div className="flex items-center justify-between rounded-lg bg-ink-800/50 px-3 py-2.5 text-sm">
      <div>
        <div className="font-medium text-slate-200">{name}</div>
        <div className="text-xs text-slate-500">{status?.message || status?.status || 'unknown'}</div>
      </div>
      <span className={`h-2.5 w-2.5 rounded-full ${ok ? 'bg-emerald-400' : 'bg-amber-400'}`} />
    </div>
  )
}

function configSet(v: unknown): boolean {
  if (v == null) return false
  if (typeof v === 'string') return v.trim().length > 0
  return Object.keys(v as object).length > 0
}