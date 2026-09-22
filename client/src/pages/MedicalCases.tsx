import { useState } from 'react'
import { api } from '../lib/api'
import { Badge, Btn, Card, Empty, Field, Modal, Spinner, inputCls, statusTone, useApi } from '../components/ui'

export default function MedicalCases() {
  const personnel = useApi<any[]>('/api/personnel?')
  const [edit, setEdit] = useState<any | null>(null)
  const [health, setHealth] = useState('fit')
  const [note, setNote] = useState('')
  const [msg, setMsg] = useState('')

  const rows = (personnel.data || []).filter((p) => (p.health_status || 'fit') !== 'fit')

  const save = async () => {
    if (!edit) return
    try {
      await api(`/api/personnel/${edit.id}`, { method: 'PATCH', body: JSON.stringify({ health_status: health, medical_notes: note }) })
      setMsg(`Updated ${edit.name}.`)
      setEdit(null)
      personnel.reload()
      setTimeout(() => setMsg(''), 3000)
    } catch (e: any) {
      setMsg(e?.message || 'Failed')
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-slate-50">Medical Cases</h1>
        <p className="text-xs text-slate-400">Crew members under clinical attention — case notes are access-restricted</p>
      </div>

      {msg ? <p className="text-sm text-ice-300">{msg}</p> : null}
      {personnel.loading ? <Spinner label="Loading cases…" /> : null}
      {!personnel.loading && !rows.length ? <Empty label="No active medical cases — all personnel fit." /> : null}

      <div className="space-y-2">
        {rows.map((p) => (
          <Card key={p.id} className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-100">{p.name}</span>
                  <Badge tone={statusTone(p.health_status)}>{p.health_status}</Badge>
                  <Badge tone="slate">{p.role}</Badge>
                </div>
                <div className="mt-0.5 text-xs text-slate-500">{p.personnel_id} · {p.station_code || '—'} · {p.movement || 'station'}</div>
                {p.medical_notes ? (
                  <div className="mt-2 rounded-lg border border-rose-400/20 bg-rose-500/5 px-3 py-2 text-sm text-slate-300">{p.medical_notes}</div>
                ) : null}
              </div>
              <Btn kind="outline" onClick={() => { setEdit(p); setHealth(p.health_status); setNote(p.medical_notes || '') }}>
                Update case
              </Btn>
            </div>
          </Card>
        ))}
      </div>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit ? `Medical case — ${edit.name}` : ''}>
        <div className="space-y-3">
          <Field label="Health status">
            <select className={inputCls} value={health} onChange={(e) => setHealth(e.target.value)}>
              {['fit', 'recovering', 'sick', 'injured', 'critical'].map((h) => <option key={h} value={h}>{h}</option>)}
            </select>
          </Field>
          <Field label="Clinical notes">
            <textarea className={inputCls} rows={4} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Assessment, treatment, follow-up plan…" />
          </Field>
          <div className="flex justify-end gap-2">
            <Btn kind="ghost" onClick={() => setEdit(null)}>Cancel</Btn>
            <Btn onClick={save}>Save case</Btn>
          </div>
        </div>
      </Modal>
    </div>
  )
}