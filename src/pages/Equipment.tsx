import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import { Badge, Btn, Card, Field, Modal, Spinner, inputCls, statusTone, useApi } from '../components/ui'

export default function Equipment({ scope }: { scope: 'scientist' | 'field' }) {
  const { user, can } = useAuth()
  const mid = user?.mission_id
  const assets = useApi<any[]>(mid ? `/api/assets?mission_id=${mid}` : null)
  const [reportFor, setReportFor] = useState<any | null>(null)
  const [note, setNote] = useState('')
  const [msg, setMsg] = useState('')

  const rows = (assets.data || []).filter((a) => (scope === 'scientist' ? a.category === 'scientific' : true))
  const canWrite = can('assets:write')

  const report = async () => {
    if (!reportFor) return
    try {
      await api(`/api/assets/${reportFor.id}`, { method: 'PATCH', body: JSON.stringify({ operational_status: 'maintenance' }) })
      setMsg(`Flagged ${reportFor.name} for maintenance.`)
      setReportFor(null)
      assets.reload()
      setTimeout(() => setMsg(''), 3000)
    } catch (e: any) {
      setMsg(e?.message || 'Failed')
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-slate-50">{scope === 'field' ? 'My Equipment' : 'Research Equipment'}</h1>
        <p className="text-xs text-slate-400">{scope === 'field' ? 'Gear assigned to this expedition with health status' : 'Scientific instruments and field apparatus'}</p>
      </div>

      {msg ? <p className="text-sm text-ice-300">{msg}</p> : null}
      {assets.loading ? <Spinner label="Loading equipment…" /> : null}
      {!assets.loading && !rows.length ? <p className="rounded-xl border border-dashed border-ink-700 p-8 text-center text-sm text-slate-400">No equipment found in this scope.</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((a) => (
          <Card key={a.id} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-100">{a.name || a.asset_id}</div>
                <code className="text-xs text-ice-400">{a.asset_id}</code>
              </div>
              <Badge tone={statusTone(a.operational_status || a.risk?.status)}>{a.operational_status || a.risk?.status}</Badge>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-400">
              <div className="rounded-lg bg-ink-800/50 px-2 py-1.5">category: {a.category || '—'}</div>
              <div className="rounded-lg bg-ink-800/50 px-2 py-1.5">loc: {a.location || '—'}</div>
              <div className="rounded-lg bg-ink-800/50 px-2 py-1.5">next maint: {a.next_maintenance || '—'}</div>
              <div className="rounded-lg bg-ink-800/50 px-2 py-1.5">condition: {a.condition || a.risk?.status || '—'}</div>
            </div>
            {a.sensor_data ? (
              <div className="mt-2 rounded-lg bg-ink-800/40 px-2 py-1.5 text-[11px] text-slate-500">
                sensor: {JSON.stringify(a.sensor_data).slice(0, 80)}
              </div>
            ) : null}
            {canWrite ? (
              <Btn kind="ghost" className="mt-3 w-full text-xs" onClick={() => setReportFor(a)}>
                Report for maintenance
              </Btn>
            ) : null}
          </Card>
        ))}
      </div>

      <Modal open={!!reportFor} onClose={() => setReportFor(null)} title={reportFor?.name || 'Report maintenance'}>
        <div className="space-y-3">
          <Field label="Issue note"><textarea className={inputCls} rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Describe the fault / condition…" /></Field>
          <div className="flex justify-end gap-2">
            <Btn kind="ghost" onClick={() => setReportFor(null)}>Cancel</Btn>
            <Btn onClick={report}>Flag maintenance</Btn>
          </div>
        </div>
      </Modal>
    </div>
  )
}